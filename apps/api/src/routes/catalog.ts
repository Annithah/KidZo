import { and, asc, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { catalogQuerySchema, isAgeAppropriate } from '@kidzo/shared';
import { content, stickers } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { notFound, parse } from '../lib/errors';
import { toContentDetail, toContentSummary, toSticker } from '../lib/serialize';
import { getOwnedChild } from '../lib/usage';

export async function catalogRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  /** Published content, optionally tailored to a child's age. Bodies are fetched per item. */
  app.get('/catalog', async (request) => {
    const query = parse(catalogQuerySchema, request.query);
    const filters = [eq(content.status, 'published')];
    if (query.type) filters.push(eq(content.type, query.type));
    if (query.calm !== undefined) filters.push(eq(content.calm, query.calm));
    let rows = await app.db
      .select()
      .from(content)
      .where(and(...filters))
      .orderBy(desc(content.featured), asc(content.ageMin), desc(content.publishedAt));
    if (query.childId) {
      const { child } = await getOwnedChild(app.db, request.user.sub, query.childId);
      rows = rows.filter((r) => isAgeAppropriate(child.age, r.ageMin, r.ageMax));
    }
    if (query.skill) {
      const skill = query.skill;
      rows = rows.filter((r) => r.skills.includes(skill));
    }
    return rows.map(toContentSummary);
  });

  /** Full content package including the story graph, used for playing and offline download. */
  app.get('/content/:id', async (request) => {
    const { id } = parse(z.object({ id: z.uuid() }), request.params);
    const [row] = await app.db
      .select()
      .from(content)
      .where(and(eq(content.id, id), eq(content.status, 'published')))
      .limit(1);
    if (!row) throw notFound('Content');
    return toContentDetail(row);
  });

  app.get('/stickers', async () => {
    const rows = await app.db.select().from(stickers).orderBy(asc(stickers.createdAt));
    return rows.map(toSticker);
  });
}
