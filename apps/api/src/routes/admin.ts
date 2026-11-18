import { and, count, desc, eq, gte, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  ALLOWED_MEDIA_TYPES,
  CONTENT_STATUSES,
  CONTENT_TYPES,
  MAX_MEDIA_BYTES,
  contentInputSchema,
  estimatePackageBytes,
  paginationQuerySchema,
  stickerInputSchema,
  publishProblems,
  type AdminStats,
} from '@kidzo/shared';
import type { Db } from '../db/client';
import { auditLogs, children, content, media, playSessions, stickers, users } from '../db/schema';
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
    const since = new Date(Date.now() - 7 * 86_400_000);
    const [parents] = await app.db.select({ n: count() }).from(users).where(eq(users.role, 'parent'));
    const [kids] = await app.db.select({ n: count() }).from(children);
    const statusRows = await app.db.select({ status: content.status, n: count() }).from(content).groupBy(content.status);
    const [sessions] = await app.db
      .select({
        total: count(),
        completed: sql<number>`count(*) filter (where ${playSessions.completed})::int`,
      })
      .from(playSessions)
      .where(gte(playSessions.startedAt, since));
    const top = await app.db
      .select({ id: content.id, title: content.title, plays: count(playSessions.id) })
      .from(playSessions)
      .innerJoin(content, eq(content.id, playSessions.contentId))
      .where(gte(playSessions.startedAt, since))
      .groupBy(content.id)
      .orderBy(desc(count(playSessions.id)))
      .limit(5);
    const byStatus = Object.fromEntries(statusRows.map((r) => [r.status, r.n]));
    return {
      parents: parents?.n ?? 0,
      children: kids?.n ?? 0,
      content: {
        published: byStatus.published ?? 0,
        draft: byStatus.draft ?? 0,
        archived: byStatus.archived ?? 0,
      },
      sessionsLast7Days: sessions?.total ?? 0,
      completionsLast7Days: Number(sessions?.completed ?? 0),
      topContent: top.map((t) => ({ id: t.id, title: t.title.en, plays: t.plays })),
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
        .values({ ...input, status: 'draft', sizeBytes: estimatePackageBytes(input.body), createdBy: request.user.sub })
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

  const setStatus = (status: 'draft' | 'archived', action: string) => async (request: { params: unknown; user: { sub: string } }) => {
    const { id } = parse(idParams, request.params);
    const [row] = await app.db
      .update(content)
      .set({ status, updatedAt: new Date() })
      .where(eq(content.id, id))
      .returning();
    if (!row) throw notFound('Content');
    await audit(app.db, { actorId: request.user.sub, action, entity: 'content', entityId: id });
    return toContentSummary(row);
  };
  app.post('/admin/content/:id/unpublish', setStatus('draft', 'content.unpublish'));
  app.post('/admin/content/:id/archive', setStatus('archived', 'content.archive'));

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
    const file = await request.file({ limits: { fileSize: MAX_MEDIA_BYTES, files: 1 } });
    if (!file) throw badRequest('Attach a file');
    const data = await file.toBuffer();
    if (file.file.truncated) throw badRequest('File is too large (max 15 MB)');
    const detected = sniffMediaType(data);
    if (!detected || !(ALLOWED_MEDIA_TYPES as readonly string[]).includes(detected)) {
      throw badRequest('Only PNG, JPEG, WebP images and MP3, M4A, AAC audio are allowed');
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
