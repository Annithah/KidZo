import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ALLOWED_MEDIA_TYPES,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  PUBLISHABLE_STATUSES,
  summarizeStoryPaths,
  type ContentStatus,
  type StoryChoiceInsights,
  MAX_MEDIA_BYTES,
  MAX_UPLOAD_BYTES,
  MAX_VIDEO_BYTES,
  contentInputSchema,
  estimatePackageBytes,
  gateFields,
  paginationQuerySchema,
  stickerInputSchema,
  publishProblems,
  type AdminStats,
  type Skill,
} from '@kidzo/shared';
import type { Db } from '../db/client';
import { auditLogs, children, content, guestContentDailyStats, media, playSessions, stickers, users } from '../db/schema';
import { requireAdmin } from '../lib/auth';
import { audit } from '../lib/audit';
import { AppError, badRequest, conflict, notFound, parse } from '../lib/errors';
import { toContentDetail, toContentSummary, toSticker } from '../lib/serialize';
import { sniffMediaType } from '../lib/storage';

const idParams = z.object({ id: z.uuid() });

const contentListQuery = paginationQuerySchema.extend({
  status: z.enum(CONTENT_STATUSES).optional(),
  type: z.enum(CONTENT_TYPES).optional(),
  q: z.string().trim().max(80).optional(),
});

async function assertStickerExists(db: Db, stickerId: string | null): Promise<void> {
  if (!stickerId) return;
  const [row] = await db.select({ id: stickers.id }).from(stickers).where(eq(stickers.id, stickerId)).limit(1);
  if (!row) throw badRequest('Reward sticker does not exist');
}

const isUniqueViolation = (error: unknown): boolean => {
  const code = (error as { code?: string; cause?: { code?: string } }).code ?? (error as { cause?: { code?: string } }).cause?.code;
  return code === '23505';
};

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAdmin);

  app.get('/admin/stats', async (): Promise<AdminStats> => {
    const now = new Date();
    const since = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
    const [parents] = await app.db.select({ n: count() }).from(users).where(eq(users.role, 'parent'));
    const [kids] = await app.db.select({ n: count() }).from(children);
    const statusRows = await app.db.select({ status: content.status, n: count() }).from(content).groupBy(content.status);
    const activity = await app.db
      .select({
        id: content.id,
        title: content.title,
        type: content.type,
        skills: content.skills,
        startedAt: playSessions.startedAt,
        secondsPlayed: playSessions.secondsPlayed,
        completed: playSessions.completed,
      })
      .from(playSessions)
      .innerJoin(content, eq(content.id, playSessions.contentId))
      .where(gte(playSessions.startedAt, since));
    const guestActivity = await app.db
      .select({
        id: content.id,
        title: content.title,
        type: content.type,
        skills: content.skills,
        date: guestContentDailyStats.date,
        plays: guestContentDailyStats.plays,
        completions: guestContentDailyStats.completions,
        secondsPlayed: guestContentDailyStats.secondsPlayed,
        completedSeconds: guestContentDailyStats.completedSeconds,
      })
      .from(guestContentDailyStats)
      .innerJoin(content, eq(content.id, guestContentDailyStats.contentId))
      .where(gte(guestContentDailyStats.date, since.toISOString().slice(0, 10)));
    const newFamilies = await app.db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(and(eq(users.role, 'parent'), gte(users.createdAt, since)));
    const newChildren = await app.db.select({ createdAt: children.createdAt }).from(children).where(gte(children.createdAt, since));

    const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, r.n]));
    const contentActivity = new Map<string, { id: string; title: string; type: string; plays: number; completions: number }>();
    const skillPlays = new Map<Skill, number>();
    const daily = new Map<string, AdminStats['dailyActivity'][number]>();
    for (let index = 0; index < 7; index += 1) {
      const date = new Date(since.getTime() + index * 86_400_000).toISOString().slice(0, 10);
      daily.set(date, { date, newFamilies: 0, newChildren: 0, plays: 0, completions: 0 });
    }
    let playedSeconds = 0;
    let completedSeconds = 0;
    let completionCount = 0;

    for (const row of activity) {
      const current = contentActivity.get(row.id) ?? {
        id: row.id,
        title: row.title.en,
        type: row.type,
        plays: 0,
        completions: 0,
      };
      current.plays += 1;
      if (row.completed) {
        current.completions += 1;
        completionCount += 1;
        completedSeconds += row.secondsPlayed;
      }
      contentActivity.set(row.id, current);
      playedSeconds += row.secondsPlayed;
      for (const skill of row.skills) skillPlays.set(skill, (skillPlays.get(skill) ?? 0) + 1);
      const day = daily.get(row.startedAt.toISOString().slice(0, 10));
      if (day) {
        day.plays += 1;
        if (row.completed) day.completions += 1;
      }
    }

    let sessionsLast7Days = activity.length;
    for (const row of guestActivity) {
      const current = contentActivity.get(row.id) ?? {
        id: row.id,
        title: row.title.en,
        type: row.type,
        plays: 0,
        completions: 0,
      };
      current.plays += row.plays;
      current.completions += row.completions;
      contentActivity.set(row.id, current);
      sessionsLast7Days += row.plays;
      completionCount += row.completions;
      playedSeconds += row.secondsPlayed;
      completedSeconds += row.completedSeconds;
      for (const skill of row.skills) skillPlays.set(skill, (skillPlays.get(skill) ?? 0) + row.plays);
      const day = daily.get(row.date);
      if (day) {
        day.plays += row.plays;
        day.completions += row.completions;
      }
    }

    for (const row of newFamilies) {
      const day = daily.get(row.createdAt.toISOString().slice(0, 10));
      if (day) day.newFamilies += 1;
    }
    for (const row of newChildren) {
      const day = daily.get(row.createdAt.toISOString().slice(0, 10));
      if (day) day.newChildren += 1;
    }

    const byPlays = <T extends { plays: number; title: string }>(a: T, b: T) => b.plays - a.plays || a.title.localeCompare(b.title);
    const rankedContent = [...contentActivity.values()].sort(byPlays);
    return {
      parents: parents?.n ?? 0,
      children: kids?.n ?? 0,
      content: {
        published: byStatus.published ?? 0,
        draft: byStatus.draft ?? 0,
        review: byStatus.review ?? 0,
        unpublished: byStatus.unpublished ?? 0,
        archived: byStatus.archived ?? 0,
      },
      sessionsLast7Days,
      completionsLast7Days: completionCount,
      completionRatePercent: sessionsLast7Days === 0 ? 0 : Math.round((completionCount / sessionsLast7Days) * 1000) / 10,
      averagePlaySeconds: sessionsLast7Days === 0 ? 0 : Math.round(playedSeconds / sessionsLast7Days),
      averageCompletionSeconds: completionCount === 0 ? 0 : Math.round(completedSeconds / completionCount),
      topContent: rankedContent.slice(0, 5).map(({ id, title, plays }) => ({ id, title, plays })),
      topSkills: [...skillPlays.entries()]
        .map(([skill, plays]) => ({ skill, plays }))
        .sort((a, b) => b.plays - a.plays || a.skill.localeCompare(b.skill))
        .slice(0, 5),
      topGames: rankedContent.filter((item) => item.type === 'game').slice(0, 5).map(({ id, title, plays }) => ({ id, title, plays })),
      lowEngagementContent: [...contentActivity.values()]
        .filter((item) => item.plays >= 3)
        .map(({ id, title, plays, completions }) => ({
          id,
          title,
          plays,
          completionRatePercent: Math.round((completions / plays) * 1000) / 10,
        }))
        .sort((a, b) => a.completionRatePercent - b.completionRatePercent || b.plays - a.plays || a.title.localeCompare(b.title))
        .slice(0, 5),
      dailyActivity: [...daily.values()],
    };
  });

  app.get('/admin/users', async (request) => {
    const { limit, offset } = parse(paginationQuerySchema, request.query);
    const rows = await app.db
      .select({
        id: users.id,
        email: users.email,
        displayName: users.displayName,
        role: users.role,
        createdAt: users.createdAt,
        childCount: count(children.id),
      })
      .from(users)
      .leftJoin(children, eq(children.parentId, users.id))
      .groupBy(users.id)
      .orderBy(desc(users.createdAt))
      .limit(limit)
      .offset(offset);
    const [total] = await app.db.select({ n: count() }).from(users);
    return {
      total: total?.n ?? 0,
      items: rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
    };
  });

  // Content management

  app.get('/admin/content', async (request) => {
    const query = parse(contentListQuery, request.query);
    const filters = [];
    if (query.status) filters.push(eq(content.status, query.status));
    if (query.type) filters.push(eq(content.type, query.type));
    if (query.q) filters.push(sql`(${content.title}->>'en') ilike ${`%${query.q}%`}`);
    const where = filters.length ? and(...filters) : undefined;
    const rows = await app.db
      .select()
      .from(content)
      .where(where)
      .orderBy(desc(content.updatedAt))
      .limit(query.limit)
      .offset(query.offset);
    const [total] = await app.db.select({ n: count() }).from(content).where(where);
    return { total: total?.n ?? 0, items: rows.map(toContentSummary) };
  });

  app.get('/admin/content/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    const [row] = await app.db.select().from(content).where(eq(content.id, id)).limit(1);
    if (!row) throw notFound('Content');
    return { ...toContentDetail(row), problems: publishProblems(row) };
  });

  app.post('/admin/content', async (request, reply) => {
    const input = parse(contentInputSchema, request.body);
    await assertStickerExists(app.db, input.rewardStickerId);
    try {
      const [row] = await app.db
        .insert(content)
        .values({ ...input, ...gateFields(input), status: 'draft', sizeBytes: estimatePackageBytes(input.body), createdBy: request.user.sub })
        .returning();
      if (!row) throw new AppError(500, 'INTERNAL', 'Could not create content');
      await audit(app.db, { actorId: request.user.sub, action: 'content.create', entity: 'content', entityId: row.id });
      return reply.status(201).send({ ...toContentDetail(row), problems: publishProblems(input) });
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('That slug is already used');
      throw error;
    }
  });

  app.put('/admin/content/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    const input = parse(contentInputSchema, request.body);
    await assertStickerExists(app.db, input.rewardStickerId);
    const [current] = await app.db.select().from(content).where(eq(content.id, id)).limit(1);
    if (!current) throw notFound('Content');
    if (current.status === 'published') {
      const problems = publishProblems(input);
      if (problems.length) throw new AppError(400, 'PUBLISH_BLOCKED', 'Fix these before saving live content', problems);
    }
    try {
      const [row] = await app.db
        .update(content)
        .set({
          ...input,
          ...gateFields(input),
          sizeBytes: estimatePackageBytes(input.body),
          version: current.version + 1,
          updatedAt: new Date(),
        })
        .where(eq(content.id, id))
        .returning();
      if (!row) throw notFound('Content');
      await audit(app.db, { actorId: request.user.sub, action: 'content.update', entity: 'content', entityId: id });
      return { ...toContentDetail(row), problems: publishProblems(input) };
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('That slug is already used');
      throw error;
    }
  });

  app.post('/admin/content/:id/publish', async (request) => {
    const { id } = parse(idParams, request.params);
    const [current] = await app.db.select().from(content).where(eq(content.id, id)).limit(1);
    if (!current) throw notFound('Content');
    if (!PUBLISHABLE_STATUSES.includes(current.status)) {
      throw new AppError(409, 'REVIEW_REQUIRED', 'Submit this content for review before publishing it');
    }
    const problems = publishProblems(current);
    if (problems.length) throw new AppError(400, 'PUBLISH_BLOCKED', 'This content is not ready to publish', problems);
    const [row] = await app.db
      .update(content)
      .set({ status: 'published', publishedAt: current.publishedAt ?? new Date(), updatedAt: new Date() })
      .where(eq(content.id, id))
      .returning();
    if (!row) throw notFound('Content');
    await audit(app.db, { actorId: request.user.sub, action: 'content.publish', entity: 'content', entityId: id });
    return toContentSummary(row);
  });

  /**
   * Moves content between workflow states. `from` lists the states the move is allowed from;
   * submitting for review also requires the content to pass the publish checks.
   */
  const transition =
    (to: ContentStatus, from: readonly ContentStatus[], action: string, message: string, checkReady = false) =>
    async (request: { params: unknown; user: { sub: string } }) => {
      const { id } = parse(idParams, request.params);
      const [current] = await app.db.select().from(content).where(eq(content.id, id)).limit(1);
      if (!current) throw notFound('Content');
      if (!from.includes(current.status)) throw new AppError(409, 'INVALID_STATUS', message);
      if (checkReady) {
        const problems = publishProblems(current);
        if (problems.length) throw new AppError(400, 'PUBLISH_BLOCKED', 'Fix these before sending it for review', problems);
      }
      const [row] = await app.db
        .update(content)
        .set({ status: to, updatedAt: new Date() })
        .where(eq(content.id, id))
        .returning();
      if (!row) throw notFound('Content');
      await audit(app.db, { actorId: request.user.sub, action, entity: 'content', entityId: id });
      return toContentSummary(row);
    };
  app.post('/admin/content/:id/submit', transition('review', ['draft'], 'content.submit', 'Only drafts can be sent for review', true));
  app.post('/admin/content/:id/request-changes', transition('draft', ['review'], 'content.request_changes', 'Only content in review can be sent back'));
  app.post('/admin/content/:id/unpublish', transition('unpublished', ['published'], 'content.unpublish', 'Only live content can be unpublished'));
  app.post('/admin/content/:id/archive', transition('archived', ['draft', 'review', 'unpublished'], 'content.archive', 'Unpublish live content before archiving it'));
  app.post('/admin/content/:id/restore', transition('draft', ['archived'], 'content.restore', 'Only archived content can be restored'));

  /** Popular choices and endings per branching story, from completed sessions in the last N days. */
  app.get('/admin/analytics/story-choices', async (request): Promise<StoryChoiceInsights> => {
    const { days } = parse(z.object({ days: z.coerce.number().int().min(1).max(365).default(30) }), request.query);
    const since = new Date(Date.now() - days * 86_400_000);
    const stories = await app.db.select().from(content).where(eq(content.type, 'adventure'));
    const sessions = await app.db
      .select({ contentId: playSessions.contentId, path: playSessions.path })
      .from(playSessions)
      .where(and(eq(playSessions.completed, true), gte(playSessions.startedAt, since)));
    const pathsByContent = new Map<string, string[][]>();
    for (const s of sessions) {
      const list = pathsByContent.get(s.contentId) ?? [];
      list.push(s.path);
      pathsByContent.set(s.contentId, list);
    }
    const pct = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 1000) / 10 : 0);
    const excerpt = (text: string) => (text.length > 90 ? `${text.slice(0, 87)}...` : text);
    const result: StoryChoiceInsights['stories'] = [];
    for (const story of stories) {
      if (story.body.kind !== 'branching') continue;
      const body = story.body;
      const summary = summarizeStoryPaths(body, pathsByContent.get(story.id) ?? []);
      if (summary.paths === 0) continue;
      const nodes = new Map(body.nodes.map((n) => [n.id, n]));
      const endingsTotal = summary.endings.reduce((n, e) => n + e.count, 0);
      result.push({
        id: story.id,
        title: story.title.en,
        paths: summary.paths,
        endings: summary.endings.map((e) => ({ ...e, text: excerpt(nodes.get(e.nodeId)?.text.en ?? e.nodeId), percent: pct(e.count, endingsTotal) })),
        choices: summary.choices.map((c) => {
          const node = nodes.get(c.nodeId);
          const picked = c.picks.reduce((n, p) => n + p.count, 0);
          return {
            nodeId: c.nodeId,
            text: excerpt(node?.text.en ?? c.nodeId),
            reached: c.reached,
            picks: c.picks.map((p) => ({ ...p, label: node?.choices.find((x) => x.id === p.choiceId)?.label.en ?? p.choiceId, percent: pct(p.count, picked) })),
          };
        }),
      });
    }
    result.sort((a, b) => b.paths - a.paths);
    return { days, stories: result };
  });

  app.delete('/admin/content/:id', async (request, reply) => {
    const { id } = parse(idParams, request.params);
    const [current] = await app.db.select({ status: content.status }).from(content).where(eq(content.id, id)).limit(1);
    if (!current) throw notFound('Content');
    if (current.status === 'published') throw badRequest('Unpublish content before deleting it');
    const [plays] = await app.db.select({ n: count() }).from(playSessions).where(eq(playSessions.contentId, id));
    if ((plays?.n ?? 0) > 0) throw badRequest('Content with play history can be archived, not deleted');
    await app.db.delete(content).where(eq(content.id, id));
    await audit(app.db, { actorId: request.user.sub, action: 'content.delete', entity: 'content', entityId: id });
    return reply.status(204).send();
  });

  // Stickers

  app.get('/admin/stickers', async () => {
    const rows = await app.db.select().from(stickers).orderBy(desc(stickers.createdAt));
    return rows.map(toSticker);
  });

  app.post('/admin/stickers', async (request, reply) => {
    const input = parse(stickerInputSchema, request.body);
    try {
      const [row] = await app.db.insert(stickers).values(input).returning();
      if (!row) throw new AppError(500, 'INTERNAL', 'Could not create sticker');
      await audit(app.db, { actorId: request.user.sub, action: 'sticker.create', entity: 'sticker', entityId: row.id });
      return reply.status(201).send(toSticker(row));
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('That slug is already used');
      throw error;
    }
  });

  app.put('/admin/stickers/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    const input = parse(stickerInputSchema, request.body);
    try {
      const [row] = await app.db.update(stickers).set(input).where(eq(stickers.id, id)).returning();
      if (!row) throw notFound('Sticker');
      await audit(app.db, { actorId: request.user.sub, action: 'sticker.update', entity: 'sticker', entityId: id });
      return toSticker(row);
    } catch (error) {
      if (isUniqueViolation(error)) throw conflict('That slug is already used');
      throw error;
    }
  });

  app.delete('/admin/stickers/:id', async (request, reply) => {
    const { id } = parse(idParams, request.params);
    const deleted = await app.db.delete(stickers).where(eq(stickers.id, id)).returning({ id: stickers.id });
    if (deleted.length === 0) throw notFound('Sticker');
    await audit(app.db, { actorId: request.user.sub, action: 'sticker.delete', entity: 'sticker', entityId: id });
    return reply.status(204).send();
  });

  // Media uploads

  app.post('/admin/media', async (request, reply) => {
    const file = await request.file({ limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } });
    if (!file) throw badRequest('Attach a file');
    const data = await file.toBuffer();
    const detected = sniffMediaType(data);
    if (!detected || !(ALLOWED_MEDIA_TYPES as readonly string[]).includes(detected)) {
      throw badRequest('Only PNG, JPEG, WebP images, MP3, M4A, AAC audio, and MP4 video are allowed');
    }
    const maxBytes = detected === 'video/mp4' ? MAX_VIDEO_BYTES : MAX_MEDIA_BYTES;
    if (file.file.truncated || data.length > maxBytes) {
      throw badRequest(`File is too large (max ${Math.round(maxBytes / (1024 * 1024))} MB)`);
    }
    const stored = await app.storage.put(data, detected);
    await app.db.insert(media).values({
      storageKey: stored.key,
      contentType: detected,
      sizeBytes: data.length,
      createdBy: request.user.sub,
    });
    await audit(app.db, { actorId: request.user.sub, action: 'media.upload', entity: 'media', entityId: stored.key });
    return reply.status(201).send({ url: stored.url, contentType: detected, sizeBytes: data.length });
  });

  app.get('/admin/audit', async (request) => {
    const { limit, offset } = parse(paginationQuerySchema, request.query);
    const rows = await app.db
      .select({
        id: auditLogs.id,
        action: auditLogs.action,
        entity: auditLogs.entity,
        entityId: auditLogs.entityId,
        createdAt: auditLogs.createdAt,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .orderBy(desc(auditLogs.createdAt))
      .limit(limit)
      .offset(offset);
    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  });
}
