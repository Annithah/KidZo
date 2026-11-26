import { and, asc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ageGroupFor, computeStars, guestCatalogQuerySchema, guestPlaybackSchema, isAgeAppropriate, isForAgeGroup } from '@kidzo/shared';
import { content, guestContentDailyStats } from '../db/schema';
import { badRequest, notFound, parse } from '../lib/errors';
import { toContentDetail, toContentSummary } from '../lib/serialize';

export async function guestRoutes(app: FastifyInstance): Promise<void> {
  app.post('/guest/catalog', async (request) => {
    const query = parse(guestCatalogQuerySchema, request.body);
    const filters = [eq(content.status, 'published')];
    if (query.type) filters.push(eq(content.type, query.type));
    const rows = await app.db.select().from(content).where(and(...filters)).orderBy(asc(content.ageMin));
    return rows
      .filter((row) => isAgeAppropriate(query.age, row.ageMin, row.ageMax) && isForAgeGroup(ageGroupFor(query.age), row))
      .filter((row) => !query.skill || row.skills.includes(query.skill))
      .map(toContentSummary);
  });

  app.post('/guest/content/:id', async (request) => {
    const { age } = parse(guestCatalogQuerySchema.pick({ age: true }), request.body);
    const { id } = parse(z.object({ id: z.uuid() }), request.params);
    const [row] = await app.db.select().from(content).where(and(eq(content.id, id), eq(content.status, 'published'))).limit(1);
    if (!row || !isAgeAppropriate(age, row.ageMin, row.ageMax) || !isForAgeGroup(ageGroupFor(age), row)) throw notFound('Content');
    return toContentDetail(row);
  });

  app.post(
    '/guest/playback',
    { config: { rateLimit: { max: 60, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const input = parse(guestPlaybackSchema, request.body);
      const [row] = await app.db
        .select({ id: content.id, body: content.body })
        .from(content)
        .where(and(eq(content.id, input.contentId), eq(content.status, 'published')))
        .limit(1);
      if (!row) throw notFound('Content');
      if (input.completed && !computeStars(row.body, 0, input.path, input.answers).valid) {
        throw badRequest('This adventure has not reached an ending yet');
      }

      const date = new Date().toISOString().slice(0, 10);
      const completionIncrement = input.completed ? 1 : 0;
      await app.db
        .insert(guestContentDailyStats)
        .values({
          contentId: row.id,
          date,
          plays: 1,
          completions: completionIncrement,
          secondsPlayed: input.secondsPlayed,
          completedSeconds: input.completed ? input.secondsPlayed : 0,
        })
        .onConflictDoUpdate({
          target: [guestContentDailyStats.contentId, guestContentDailyStats.date],
          set: {
            plays: sql`${guestContentDailyStats.plays} + 1`,
            completions: sql`${guestContentDailyStats.completions} + ${completionIncrement}`,
            secondsPlayed: sql`${guestContentDailyStats.secondsPlayed} + ${input.secondsPlayed}`,
            completedSeconds: sql`${guestContentDailyStats.completedSeconds} + ${input.completed ? input.secondsPlayed : 0}`,
          },
        });
      return reply.status(204).send();
    },
  );
}
