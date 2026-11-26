import { and, asc, desc, eq, gte, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { catalogQuerySchema, isAgeAppropriate, isAllowedForChild, recommendContent, type Recommendation, type VideoCreditEntry } from '@kidzo/shared';
import { content, playSessions, stickers } from '../db/schema';
import { requireAuth } from '../lib/auth';
import { AppError, notFound, parse } from '../lib/errors';
import { toContentDetail, toContentSummary, toSticker } from '../lib/serialize';
import { assertSameChild, getChildScope, requireChildScope, type ChildScope } from '../lib/child-scope';

type ContentRow = typeof content.$inferSelect;

/** What a child may receive: their age group, video length limit, age range and the parent's blocks. */
const allowedFor = (scope: ChildScope) => (r: ContentRow) =>
  isAgeAppropriate(scope.child.age, r.ageMin, r.ageMax) &&
  isAllowedForChild({ age: scope.child.age, blockedCategories: scope.child.settings.blockedCategories }, scope.group, r);

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
    // Kid screens send the child-scoped token; the age group comes from it, never from the query.
    const scope = await getChildScope(request);
    if (scope) {
      assertSameChild(scope, query.childId);
      rows = rows.filter(allowedFor(scope));
    } else if (query.childId) {
      throw new AppError(401, 'CHILD_TOKEN_REQUIRED', 'Choose who is playing first');
    }
    if (query.skill) {
      const skill = query.skill;
      rows = rows.filter((r) => r.skills.includes(skill));
    }
    return rows.map(toContentSummary);
  });

  /**
   * "For you" picks for one child, from what they played and finished recently. Uses only
   * content ids and completion flags from the child's own sessions; nothing leaves the family.
   */
  app.get('/catalog/recommendations', async (request): Promise<Recommendation[]> => {
    const { childId, limit } = parse(
      z.object({ childId: z.uuid().optional(), limit: z.coerce.number().int().min(1).max(12).default(6) }),
      request.query,
    );
    const scope = await requireChildScope(request);
    assertSameChild(scope, childId);
    const { child } = scope;
    const rows = (await app.db.select().from(content).where(eq(content.status, 'published'))).filter(allowedFor(scope));
    const history = await app.db
      .select({ contentId: playSessions.contentId, completed: playSessions.completed })
      .from(playSessions)
      .where(eq(playSessions.childId, child.id))
      .orderBy(desc(playSessions.startedAt))
      .limit(200);
    return recommendContent({ age: child.age, blockedCategories: child.settings.blockedCategories }, rows, history, limit).map((r) => ({
      item: toContentSummary(r.item),
      becauseSkill: r.becauseSkill as Recommendation['becauseSkill'],
    }));
  });

  /** "Continue watching": items this child started in the last 14 days but did not finish. */
  app.get('/catalog/continue', async (request) => {
    const scope = await requireChildScope(request);
    const since = new Date(Date.now() - 14 * 86_400_000);
    const sessions = await app.db
      .select({ contentId: playSessions.contentId, completed: playSessions.completed, startedAt: playSessions.startedAt })
      .from(playSessions)
      .where(and(eq(playSessions.childId, scope.child.id), gte(playSessions.startedAt, since)))
      .orderBy(desc(playSessions.startedAt))
      .limit(100);
    const finished = new Set(sessions.filter((s) => s.completed).map((s) => s.contentId));
    const order = [...new Set(sessions.filter((s) => !s.completed && !finished.has(s.contentId)).map((s) => s.contentId))].slice(0, 12);
    if (order.length === 0) return [];
    const rows = (await app.db.select().from(content).where(and(eq(content.status, 'published'), inArray(content.id, order)))).filter(allowedFor(scope));
    const byId = new Map(rows.map((r) => [r.id, r]));
    return order.flatMap((id) => {
      const row = byId.get(id);
      return row ? [toContentSummary(row)] : [];
    }).slice(0, 6);
  });

  /** Source, author and license of every published video, for the Credits screen. */
  app.get('/catalog/credits', async (request): Promise<VideoCreditEntry[]> => {
    let rows = await app.db
      .select()
      .from(content)
      .where(and(eq(content.status, 'published'), eq(content.type, 'video')))
      .orderBy(asc(content.slug));
    const scope = await getChildScope(request);
    if (scope) rows = rows.filter(allowedFor(scope));
    return rows.flatMap((r) => (r.body.kind === 'video' ? [{ contentId: r.id, title: r.title, credit: r.body.credit }] : []));
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
    // A child may only open content for their own group; anything else looks like it does not exist.
    const scope = await getChildScope(request);
    if (scope && !allowedFor(scope)(row)) throw notFound('Content');
    return toContentDetail(row);
  });

  app.get('/stickers', async () => {
    const rows = await app.db.select().from(stickers).orderBy(asc(stickers.createdAt));
    return rows.map(toSticker);
  });
}
