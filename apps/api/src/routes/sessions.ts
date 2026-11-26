import { and, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  completeSessionSchema,
  computeStars,
  evaluatePlayPolicy,
  heartbeatSchema,
  ageGroupFor,
  isForAgeGroup,
  localParts,
  startSessionSchema,
  syncSessionsSchema,
  type CompletionResult,
  type SyncResult,
} from '@kidzo/shared';
import type { Db } from '../db/client';
import { childStickers, children, content, playSessions, stickers } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { AppError, badRequest, notFound, parse } from '../lib/errors';
import { toSession, toSticker } from '../lib/serialize';
import { getOwnedChild, secondsPlayedOn } from '../lib/usage';
import { assertSameChild, requireChildScope } from '../lib/child-scope';

type SessionRow = typeof playSessions.$inferSelect;
type ContentRow = typeof content.$inferSelect;

/** Slack allowed between wall clock time and reported play time, in seconds. */
const HEARTBEAT_SLACK_SECONDS = 10;

const BLOCK_MESSAGES = {
  locked: 'A grown-up has paused play for now.',
  bedtime: "It's calm time. Games are resting until morning.",
  limit: "That's all the play time for today. See you tomorrow!",
  age: 'This one is for older explorers.',
  category: 'A grown-up has turned this kind of play off.',
} as const;

async function loadPublishedContent(db: Db, id: string): Promise<ContentRow> {
  const [row] = await db
    .select()
    .from(content)
    .where(and(eq(content.id, id), eq(content.status, 'published')))
    .limit(1);
  if (!row) throw notFound('Content');
  return row;
}

/** Caps reported seconds by the real time elapsed since the session was last active. */
function cappedSeconds(session: SessionRow, reported: number, now: Date): number {
  const elapsed = Math.floor((now.getTime() - session.lastActiveAt.getTime()) / 1000) + HEARTBEAT_SLACK_SECONDS;
  return Math.max(0, Math.min(reported, elapsed));
}

/** Awards stars and the content's sticker for a completed session. Runs inside one transaction. */
async function awardCompletion(
  db: Db,
  args: { sessionId: string; childId: string; contentRow: ContentRow; stars: number; extraSeconds: number; path: string[]; now: Date },
): Promise<CompletionResult> {
  return db.transaction(async (tx) => {
    const [session] = await tx
      .update(playSessions)
      .set({
        completed: true,
        endedAt: args.now,
        lastActiveAt: args.now,
        starsEarned: args.stars,
        path: args.path,
        secondsPlayed: sql`${playSessions.secondsPlayed} + ${args.extraSeconds}`,
      })
      .where(eq(playSessions.id, args.sessionId))
      .returning();
    const [child] = await tx
      .update(children)
      .set({ stars: sql`${children.stars} + ${args.stars}` })
      .where(eq(children.id, args.childId))
      .returning({ stars: children.stars });
    if (!session || !child) throw new AppError(500, 'INTERNAL', 'Could not save progress');

    let stickerUnlocked = null;
    if (args.contentRow.rewardStickerId) {
      const inserted = await tx
        .insert(childStickers)
        .values({ childId: args.childId, stickerId: args.contentRow.rewardStickerId })
        .onConflictDoNothing()
        .returning();
      if (inserted.length > 0) {
        const [sticker] = await tx.select().from(stickers).where(eq(stickers.id, args.contentRow.rewardStickerId));
        stickerUnlocked = sticker ? toSticker(sticker) : null;
      }
    }
    return { session: toSession(session), starsEarned: args.stars, totalStars: child.stars, stickerUnlocked };
  });
}

export async function sessionRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  const loadOwnedSession = async (parentId: string, sessionId: string) => {
    const [session] = await app.db.select().from(playSessions).where(eq(playSessions.id, sessionId)).limit(1);
    if (!session) throw notFound('Session');
    await getOwnedChild(app.db, parentId, session.childId);
    return session;
  };

  /** Starts a play session after checking locks, bedtime, age and the daily limit. */
  app.post('/sessions', async (request, reply) => {
    const input = parse(startSessionSchema, request.body);
    // Play is always for the child named in the child-scoped token.
    const scope = await requireChildScope(request);
    assertSameChild(scope, input.childId);
    const { child, timezone } = scope;

    const [existing] = await app.db
      .select()
      .from(playSessions)
      .where(eq(playSessions.clientSessionId, input.clientSessionId))
      .limit(1);
    if (existing) {
      if (existing.childId !== child.id) throw badRequest('Session id already used');
      return reply.status(200).send(toSession(existing));
    }

    const contentRow = await loadPublishedContent(app.db, input.contentId);
    // Outside the child's age group, or a video too long for it. Category blocks are checked below.
    if (!isForAgeGroup(scope.group, contentRow)) {
      throw new AppError(403, 'PLAY_BLOCKED', BLOCK_MESSAGES.age, { reason: 'age', remainingSeconds: null });
    }
    const now = new Date();
    const { date } = localParts(now, timezone);
    const policy = evaluatePlayPolicy({
      settings: child.settings,
      secondsPlayedToday: await secondsPlayedOn(app.db, child.id, date),
      now,
      timeZone: timezone,
      childAge: child.age,
      content: { calm: contentRow.calm, ageMin: contentRow.ageMin, type: contentRow.type, skills: contentRow.skills },
    });
    if (!policy.allowed && policy.reason) {
      throw new AppError(403, 'PLAY_BLOCKED', BLOCK_MESSAGES[policy.reason], {
        reason: policy.reason,
        remainingSeconds: policy.remainingSeconds,
      });
    }

    const [session] = await app.db
      .insert(playSessions)
      .values({
        clientSessionId: input.clientSessionId,
        childId: child.id,
        contentId: contentRow.id,
        familyMode: input.familyMode,
        startedAt: now,
        lastActiveAt: now,
        localDate: date,
      })
      .returning();
    if (!session) throw new AppError(500, 'INTERNAL', 'Could not start session');
    return reply.status(201).send({ ...toSession(session), remainingSeconds: policy.remainingSeconds });
  });

  /** Adds play time. Returns the remaining time so the app can show the gentle heads-up. */
  app.post('/sessions/:id/heartbeat', async (request) => {
    const { id } = parse(z.object({ id: z.uuid() }), request.params);
    const { seconds } = parse(heartbeatSchema, request.body);
    const session = await loadOwnedSession(request.user.sub, id);
    if (session.completed) return { ...toSession(session), remainingSeconds: null };
    const now = new Date();
    const add = cappedSeconds(session, seconds, now);
    const [updated] = await app.db
      .update(playSessions)
      .set({ secondsPlayed: sql`${playSessions.secondsPlayed} + ${add}`, lastActiveAt: now })
      .where(eq(playSessions.id, id))
      .returning();
    if (!updated) throw notFound('Session');
    const { child, timezone } = await getOwnedChild(app.db, request.user.sub, session.childId);
    const policy = evaluatePlayPolicy({
      settings: child.settings,
      secondsPlayedToday: await secondsPlayedOn(app.db, child.id, session.localDate),
      now,
      timeZone: timezone,
      childAge: child.age,
    });
    return { ...toSession(updated), remainingSeconds: policy.remainingSeconds, blockedReason: policy.reason };
  });

  app.post('/sessions/:id/complete', async (request) => {
    const { id } = parse(z.object({ id: z.uuid() }), request.params);
    const input = parse(completeSessionSchema, request.body);
    const session = await loadOwnedSession(request.user.sub, id);
    if (session.completed) {
      const [child] = await app.db.select({ stars: children.stars }).from(children).where(eq(children.id, session.childId));
      return { session: toSession(session), starsEarned: session.starsEarned, totalStars: child?.stars ?? 0, stickerUnlocked: null };
    }
    const [contentRow] = await app.db.select().from(content).where(eq(content.id, session.contentId)).limit(1);
    if (!contentRow) throw notFound('Content');
    const { valid, stars } = computeStars(contentRow.body, contentRow.rewardStars, input.path, input.answers);
    if (!valid) throw badRequest('This adventure has not reached an ending yet');
    const now = new Date();
    return awardCompletion(app.db, {
      sessionId: session.id,
      childId: session.childId,
      contentRow,
      stars,
      extraSeconds: cappedSeconds(session, input.seconds, now),
      path: input.path,
      now,
    });
  });

  /** Uploads sessions played offline. Idempotent on clientSessionId. */
  app.post('/sessions/sync', async (request): Promise<SyncResult> => {
    const { sessions } = parse(syncSessionsSchema, request.body);
    const result: SyncResult = { accepted: 0, duplicates: 0, rejected: [] };
    for (const item of sessions) {
      try {
        const { child, timezone } = await getOwnedChild(app.db, request.user.sub, item.childId);
        const [contentRow] = await app.db.select().from(content).where(eq(content.id, item.contentId)).limit(1);
        if (!contentRow) throw notFound('Content');
        if (!isForAgeGroup(ageGroupFor(child.age), contentRow)) throw badRequest('This is not for this age group');
        const [dupe] = await app.db
          .select()
          .from(playSessions)
          .where(eq(playSessions.clientSessionId, item.clientSessionId))
          .limit(1);
        if (dupe) {
          if (dupe.childId !== child.id) throw badRequest('Session id already used');
          // Started online, finished offline: complete the existing session with the offline result.
          const scoredDupe = item.completed && !dupe.completed
            ? computeStars(contentRow.body, contentRow.rewardStars, item.path, item.answers)
            : null;
          if (scoredDupe?.valid) {
            await awardCompletion(app.db, {
              sessionId: dupe.id,
              childId: child.id,
              contentRow,
              stars: scoredDupe.stars,
              extraSeconds: Math.max(0, item.seconds - dupe.secondsPlayed),
              path: item.path,
              now: new Date(),
            });
            result.accepted += 1;
          } else {
            if (item.seconds > dupe.secondsPlayed) {
              await app.db
                .update(playSessions)
                .set({ secondsPlayed: item.seconds })
                .where(eq(playSessions.id, dupe.id));
            }
            result.duplicates += 1;
          }
          continue;
        }
        const startedAt = new Date(item.startedAt);
        if (startedAt.getTime() > Date.now() + 5 * 60_000) throw badRequest('Session starts in the future');
        const scored = item.completed ? computeStars(contentRow.body, contentRow.rewardStars, item.path, item.answers) : null;
        const [session] = await app.db
          .insert(playSessions)
          .values({
            clientSessionId: item.clientSessionId,
            childId: child.id,
            contentId: contentRow.id,
            familyMode: item.familyMode,
            startedAt,
            lastActiveAt: startedAt,
            localDate: localParts(startedAt, timezone).date,
            secondsPlayed: item.seconds,
          })
          .returning();
        if (!session) throw new AppError(500, 'INTERNAL', 'Could not save session');
        if (scored?.valid) {
          await awardCompletion(app.db, {
            sessionId: session.id,
            childId: child.id,
            contentRow,
            stars: scored.stars,
            extraSeconds: 0,
            path: item.path,
            now: new Date(startedAt.getTime() + item.seconds * 1000),
          });
        }
        result.accepted += 1;
      } catch (error) {
        const reason = error instanceof AppError ? error.message : 'Could not sync';
        if (!(error instanceof AppError)) request.log.error({ err: error }, 'Session sync failed');
        result.rejected.push({ clientSessionId: item.clientSessionId, reason });
      }
    }
    return result;
  });
}
