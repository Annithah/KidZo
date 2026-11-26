import { asc, count, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  DEFAULT_CHILD_SETTINGS,
  createChildSchema,
  lockChildSchema,
  nextOccurrence,
  updateChildSchema,
  updateChildSettingsSchema,
} from '@kidzo/shared';
import { childStickers, children, stickers } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { audit } from '../lib/audit';
import { AppError, badRequest, parse } from '../lib/errors';
import { toChild, toSticker } from '../lib/serialize';
import { getOwnedChild, todayStatus, weeklyInsights } from '../lib/usage';
import { issueChildToken } from '../lib/child-scope';

const MAX_CHILDREN = 8;
const idParams = z.object({ id: z.uuid() });

export async function childRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  app.get('/children', async (request) => {
    const rows = await app.db
      .select()
      .from(children)
      .where(eq(children.parentId, request.user.sub))
      .orderBy(asc(children.createdAt));
    return rows.map(toChild);
  });

  app.post('/children', async (request, reply) => {
    const input = parse(createChildSchema, request.body);
    const [existing] = await app.db
      .select({ n: count() })
      .from(children)
      .where(eq(children.parentId, request.user.sub));
    if ((existing?.n ?? 0) >= MAX_CHILDREN) throw badRequest(`A family can have up to ${MAX_CHILDREN} profiles`);
    const [child] = await app.db
      .insert(children)
      .values({ ...input, parentId: request.user.sub, settings: DEFAULT_CHILD_SETTINGS })
      .returning();
    if (!child) throw new AppError(500, 'INTERNAL', 'Could not create profile');
    await audit(app.db, { actorId: request.user.sub, action: 'child.create', entity: 'child', entityId: child.id });
    return reply.status(201).send(toChild(child));
  });

  app.get('/children/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    const { child } = await getOwnedChild(app.db, request.user.sub, id);
    return toChild(child);
  });

  app.patch('/children/:id', async (request) => {
    const { id } = parse(idParams, request.params);
    const input = parse(updateChildSchema, request.body);
    await getOwnedChild(app.db, request.user.sub, id);
    const [child] = await app.db
      .update(children)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(children.id, id))
      .returning();
    if (!child) throw new AppError(500, 'INTERNAL', 'Could not update profile');
    return toChild(child);
  });

  app.delete('/children/:id', async (request, reply) => {
    const { id } = parse(idParams, request.params);
    await getOwnedChild(app.db, request.user.sub, id);
    await app.db.delete(children).where(eq(children.id, id));
    await audit(app.db, { actorId: request.user.sub, action: 'child.delete', entity: 'child', entityId: id });
    return reply.status(204).send();
  });

  app.patch('/children/:id/settings', async (request) => {
    const { id } = parse(idParams, request.params);
    const input = parse(updateChildSettingsSchema, request.body);
    const { child } = await getOwnedChild(app.db, request.user.sub, id);
    const [updated] = await app.db
      .update(children)
      .set({ settings: { ...child.settings, ...input }, updatedAt: new Date() })
      .where(eq(children.id, id))
      .returning();
    if (!updated) throw new AppError(500, 'INTERNAL', 'Could not save settings');
    return toChild(updated);
  });

  /** "Lock app now": pauses play for a number of minutes, or until bedtime ends in the morning. */
  app.post('/children/:id/lock', async (request) => {
    const { id } = parse(idParams, request.params);
    const input = parse(lockChildSchema, request.body ?? {});
    const { child, timezone } = await getOwnedChild(app.db, request.user.sub, id);
    const now = new Date();
    const until =
      input.minutes !== undefined
        ? new Date(now.getTime() + input.minutes * 60_000)
        : nextOccurrence(child.settings.bedtimeEnd, now, timezone);
    const [updated] = await app.db
      .update(children)
      .set({ settings: { ...child.settings, lockedUntil: until.toISOString() }, updatedAt: now })
      .where(eq(children.id, id))
      .returning();
    if (!updated) throw new AppError(500, 'INTERNAL', 'Could not lock');
    await audit(app.db, { actorId: request.user.sub, action: 'child.lock', entity: 'child', entityId: id });
    return toChild(updated);
  });

  app.delete('/children/:id/lock', async (request) => {
    const { id } = parse(idParams, request.params);
    const { child } = await getOwnedChild(app.db, request.user.sub, id);
    const [updated] = await app.db
      .update(children)
      .set({ settings: { ...child.settings, lockedUntil: null }, updatedAt: new Date() })
      .where(eq(children.id, id))
      .returning();
    if (!updated) throw new AppError(500, 'INTERNAL', 'Could not unlock');
    return toChild(updated);
  });

  /** Child-scoped token for kid screens. The child's age group is read from it server side. */
  app.post('/children/:id/token', async (request) => {
    const { id } = parse(z.object({ id: z.uuid() }), request.params);
    const { child } = await getOwnedChild(app.db, request.user.sub, id);
    return issueChildToken(app, request.user.sub, child.id);
  });

  app.get('/children/:id/today', async (request) => {
    const { id } = parse(idParams, request.params);
    const { child, timezone } = await getOwnedChild(app.db, request.user.sub, id);
    return todayStatus(app.db, child, timezone);
  });

  app.get('/children/:id/insights', async (request) => {
    const { id } = parse(idParams, request.params);
    const { child, timezone } = await getOwnedChild(app.db, request.user.sub, id);
    return weeklyInsights(app.db, child, timezone);
  });

  app.get('/children/:id/stickers', async (request) => {
    const { id } = parse(idParams, request.params);
    await getOwnedChild(app.db, request.user.sub, id);
    const rows = await app.db
      .select({ sticker: stickers, unlockedAt: childStickers.unlockedAt })
      .from(childStickers)
      .innerJoin(stickers, eq(stickers.id, childStickers.stickerId))
      .where(eq(childStickers.childId, id))
      .orderBy(desc(childStickers.unlockedAt));
    return rows.map((r) => ({ ...toSticker(r.sticker), unlockedAt: r.unlockedAt.toISOString() }));
  });
}
