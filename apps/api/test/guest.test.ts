import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { content, guestContentDailyStats, users } from '../src/db/schema';
import { ADMIN, bearer, createTestApp, login, type TestContext } from './helpers';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => ctx.close());

describe('guest access', () => {
  it('lists only age-appropriate published content without authentication', async () => {
    const catalog = await ctx.app.inject({ method: 'POST', url: '/guest/catalog', payload: { age: 2 } });
    expect(catalog.statusCode).toBe(200);
    expect(catalog.json().length).toBeGreaterThan(0);
    expect(catalog.json().every((item: { ageMin: number; ageMax: number; status: string }) =>
      item.ageMin <= 2 && item.ageMax >= 2 && item.status === 'published')).toBe(true);

    const [olderContent] = await ctx.database.db.select().from(content).where(eq(content.slug, 'the-secret-sky-garden'));
    if (!olderContent) throw new Error('Missing seeded sky garden');
    const denied = await ctx.app.inject({ method: 'POST', url: `/guest/content/${olderContent.id}`, payload: { age: 2 } });
    expect(denied.statusCode).toBe(404);
  });

  it('accepts completion reports and stores aggregate data without guest profiles', async () => {
    const [song] = await ctx.database.db.select().from(content).where(eq(content.slug, 'moon-song'));
    const [story] = await ctx.database.db.select().from(content).where(eq(content.slug, 'the-secret-sky-garden'));
    if (!song) throw new Error('Missing seeded moon song');
    if (!story) throw new Error('Missing seeded sky garden');
    const usersBefore = await ctx.database.db.select({ id: users.id }).from(users);

    const invalid = await ctx.app.inject({
      method: 'POST',
      url: '/guest/playback',
      payload: { contentId: story.id, secondsPlayed: 15, completed: true, path: ['invalid'] },
    });
    expect(invalid.statusCode).toBe(400);

    const first = await ctx.app.inject({
      method: 'POST',
      url: '/guest/playback',
      payload: { contentId: song.id, secondsPlayed: 30, completed: true, path: [] },
    });
    const second = await ctx.app.inject({
      method: 'POST',
      url: '/guest/playback',
      payload: { contentId: song.id, secondsPlayed: 15, completed: false, path: [] },
    });
    expect(first.statusCode).toBe(204);
    expect(second.statusCode).toBe(204);

    const [aggregate] = await ctx.database.db
      .select()
      .from(guestContentDailyStats)
      .where(eq(guestContentDailyStats.contentId, song.id));
    expect(aggregate).toMatchObject({ plays: 2, completions: 1, secondsPlayed: 45, completedSeconds: 30 });
    expect(Object.keys(aggregate ?? {}).sort()).toEqual(['completedSeconds', 'completions', 'contentId', 'date', 'plays', 'secondsPlayed'].sort());
    const usersAfter = await ctx.database.db.select({ id: users.id }).from(users);
    expect(usersAfter).toHaveLength(usersBefore.length);

    const adminToken = (await login(ctx.app, ADMIN.email, ADMIN.password)).tokens.accessToken;
    const stats = await ctx.app.inject({ method: 'GET', url: '/admin/stats', headers: bearer(adminToken) });
    expect(stats.statusCode).toBe(200);
    expect(stats.json().sessionsLast7Days).toBe(2);
    expect(stats.json().completionsLast7Days).toBe(1);
  });
});
