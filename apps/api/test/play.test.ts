import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { CompletionResult, ContentDetail, Insights, TodayStatus } from '@kidzo/shared';
import { children } from '../src/db/schema';
import { bearer, catalog, createChild, createTestApp, registerParent, type TestContext } from './helpers';

let ctx: TestContext;
beforeAll(async () => {
  ctx = await createTestApp();
});
afterAll(async () => ctx.close());

async function family(age = 6) {
  const { tokens, user } = await registerParent(ctx.app);
  const child = await createChild(ctx.app, tokens.accessToken, { age });
  // Turn bedtime off so tests do not depend on the time of day.
  await ctx.app.inject({
    method: 'PATCH',
    url: `/children/${child.id}/settings`,
    headers: bearer(tokens.accessToken),
    payload: { bedtimeEnabled: false },
  });
  return { token: tokens.accessToken, user, child };
}

async function contentBySlug(token: string, slug: string): Promise<ContentDetail> {
  const items = await catalog(ctx.app, token);
  const item = items.find((c) => c.slug === slug);
  if (!item) throw new Error(`missing ${slug}`);
  const res = await ctx.app.inject({ method: 'GET', url: `/content/${item.id}`, headers: bearer(token) });
  return res.json<ContentDetail>();
}

const start = (token: string, childId: string, contentId: string, clientSessionId = randomUUID()) =>
  ctx.app.inject({
    method: 'POST',
    url: '/sessions',
    headers: bearer(token),
    payload: { childId, contentId, clientSessionId, familyMode: true },
  });

describe('children', () => {
  it('only lets parents see their own children', async () => {
    const a = await family();
    const b = await family();
    const res = await ctx.app.inject({ method: 'GET', url: `/children/${a.child.id}`, headers: bearer(b.token) });
    expect(res.statusCode).toBe(403);
    const list = await ctx.app.inject({ method: 'GET', url: '/children', headers: bearer(b.token) });
    expect(list.json()).toHaveLength(1);
  });

  it('validates profile input and settings', async () => {
    const { token, child } = await family();
    const badAge = await ctx.app.inject({ method: 'POST', url: '/children', headers: bearer(token), payload: { name: 'X', age: 15, avatar: 'fox' } });
    expect(badAge.statusCode).toBe(400);
    const badTime = await ctx.app.inject({
      method: 'PATCH',
      url: `/children/${child.id}/settings`,
      headers: bearer(token),
      payload: { bedtimeStart: '25:00' },
    });
    expect(badTime.statusCode).toBe(400);
    const ok = await ctx.app.inject({
      method: 'PATCH',
      url: `/children/${child.id}/settings`,
      headers: bearer(token),
      payload: { dailyLimitMinutes: 45 },
    });
    expect(ok.json().settings.dailyLimitMinutes).toBe(45);
  });
});

describe('catalog', () => {
  it('filters by child age and hides drafts', async () => {
    const { token, child } = await family(3);
    const all = await catalog(ctx.app, token);
    expect(all.length).toBe(10);
    expect(all.every((c) => c.status === 'published')).toBe(true);
    const forToddler = await catalog(ctx.app, token, `?childId=${child.id}`);
    expect(forToddler.every((c) => c.ageMin <= 3)).toBe(true);
    expect(forToddler.some((c) => c.slug === 'the-secret-sky-garden')).toBe(false);
    const calm = await catalog(ctx.app, token, '?calm=true');
    expect(calm.every((c) => c.calm)).toBe(true);
  });
});

describe('play sessions', () => {
  it('plays an adventure, awards stars and a sticker once', async () => {
    const { token, child } = await family(6);
    const sky = await contentBySlug(token, 'the-secret-sky-garden');
    const startRes = await start(token, child.id, sky.id);
    expect(startRes.statusCode).toBe(201);
    const session = startRes.json<{ id: string }>();

    const bad = await ctx.app.inject({
      method: 'POST',
      url: `/sessions/${session.id}/complete`,
      headers: bearer(token),
      payload: { seconds: 5, path: ['start', 'butterfly'] },
    });
    expect(bad.statusCode).toBe(400);

    const path = ['start', 'arrive', 'bee-friend', 'family-choice', 'mirror', 'bloom', 'butterfly'];
    const done = await ctx.app.inject({
      method: 'POST',
      url: `/sessions/${session.id}/complete`,
      headers: bearer(token),
      payload: { seconds: 5, path },
    });
    expect(done.statusCode).toBe(200);
    const result = done.json<CompletionResult>();
    expect(result.starsEarned).toBe(30);
    expect(result.totalStars).toBe(30);
    expect(result.stickerUnlocked?.slug).toBe('moonbeam-butterfly');

    // Completing again is idempotent.
    const again = await ctx.app.inject({
      method: 'POST',
      url: `/sessions/${session.id}/complete`,
      headers: bearer(token),
      payload: { seconds: 5, path },
    });
    expect(again.json<CompletionResult>().totalStars).toBe(30);

    // A second play earns stars but not a duplicate sticker.
    const second = (await start(token, child.id, sky.id)).json<{ id: string }>();
    const secondDone = await ctx.app.inject({
      method: 'POST',
      url: `/sessions/${second.id}/complete`,
      headers: bearer(token),
      payload: { seconds: 5, path },
    });
    expect(secondDone.json<CompletionResult>().stickerUnlocked).toBeNull();
    expect(secondDone.json<CompletionResult>().totalStars).toBe(60);

    const stickers = await ctx.app.inject({ method: 'GET', url: `/children/${child.id}/stickers`, headers: bearer(token) });
    expect(stickers.json()).toHaveLength(1);
  });

  it('scores quizzes', async () => {
    const { token, child } = await family(5);
    const quiz = await contentBySlug(token, 'animal-friends-quiz');
    const session = (await start(token, child.id, quiz.id)).json<{ id: string }>();
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/sessions/${session.id}/complete`,
      headers: bearer(token),
      payload: { seconds: 3, path: ['q1', 'q2', 'q3'], answers: { q1: 'fox', q2: 'giraffe', q3: 'butterfly' } },
    });
    expect(res.json<CompletionResult>().starsEarned).toBe(10);
  });

  it('is idempotent on client session id', async () => {
    const { token, child } = await family();
    const song = await contentBySlug(token, 'moon-song');
    const id = randomUUID();
    const a = await start(token, child.id, song.id, id);
    const b = await start(token, child.id, song.id, id);
    expect(a.statusCode).toBe(201);
    expect(b.statusCode).toBe(200);
    expect(b.json().id).toBe(a.json().id);
  });

  it('caps heartbeat seconds by wall clock time', async () => {
    const { token, child } = await family();
    const song = await contentBySlug(token, 'moon-song');
    const session = (await start(token, child.id, song.id)).json<{ id: string }>();
    const hb = await ctx.app.inject({
      method: 'POST',
      url: `/sessions/${session.id}/heartbeat`,
      headers: bearer(token),
      payload: { seconds: 300 },
    });
    expect(hb.json().secondsPlayed).toBeLessThanOrEqual(12);
  });

  it('blocks play when the daily limit is used up', async () => {
    const { token, child } = await family();
    const game = await contentBySlug(token, 'count-with-zo');
    await ctx.app.inject({
      method: 'PATCH',
      url: `/children/${child.id}/settings`,
      headers: bearer(token),
      payload: { dailyLimitMinutes: 10 },
    });
    // Offline sync records 10 minutes played today.
    const sync = await ctx.app.inject({
      method: 'POST',
      url: '/sessions/sync',
      headers: bearer(token),
      payload: {
        sessions: [
          {
            clientSessionId: randomUUID(),
            childId: child.id,
            contentId: game.id,
            familyMode: false,
            startedAt: new Date(Date.now() - 15 * 60_000).toISOString(),
            seconds: 600,
            completed: true,
            path: ['q1', 'q2', 'q3'],
            answers: { q1: 'three', q2: 'five', q3: 'two' },
          },
        ],
      },
    });
    expect(sync.json()).toMatchObject({ accepted: 1, duplicates: 0, rejected: [] });

    const blocked = await start(token, child.id, game.id);
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error.details.reason).toBe('limit');

    const today = await ctx.app.inject({ method: 'GET', url: `/children/${child.id}/today`, headers: bearer(token) });
    const status = today.json<TodayStatus>();
    expect(status.secondsPlayed).toBe(600);
    expect(status.remainingSeconds).toBe(0);
    expect(status.starsEarnedToday).toBe(15);

    const insights = await ctx.app.inject({ method: 'GET', url: `/children/${child.id}/insights`, headers: bearer(token) });
    const weekly = insights.json<Insights>();
    expect(weekly.dailyMinutes).toHaveLength(7);
    expect(weekly.highlight?.skill).toBe('counting');
  });

  it('completes a session that started online and finished offline', async () => {
    const { token, child } = await family();
    const song = await contentBySlug(token, 'moon-song');
    const clientSessionId = randomUUID();
    const started = await start(token, child.id, song.id, clientSessionId);
    expect(started.statusCode).toBe(201);
    const sync = await ctx.app.inject({
      method: 'POST',
      url: '/sessions/sync',
      headers: bearer(token),
      payload: {
        sessions: [
          {
            clientSessionId,
            childId: child.id,
            contentId: song.id,
            familyMode: false,
            startedAt: new Date().toISOString(),
            seconds: 90,
            completed: true,
            path: [],
          },
        ],
      },
    });
    expect(sync.json()).toMatchObject({ accepted: 1, duplicates: 0 });
    const kid = await ctx.app.inject({ method: 'GET', url: `/children/${child.id}`, headers: bearer(token) });
    expect(kid.json().stars).toBe(5);
    // Syncing the same session again changes nothing.
    const again = await ctx.app.inject({
      method: 'POST',
      url: '/sessions/sync',
      headers: bearer(token),
      payload: {
        sessions: [
          {
            clientSessionId,
            childId: child.id,
            contentId: song.id,
            familyMode: false,
            startedAt: new Date().toISOString(),
            seconds: 90,
            completed: true,
            path: [],
          },
        ],
      },
    });
    expect(again.json()).toMatchObject({ accepted: 0, duplicates: 1 });
  });

  it('locks and unlocks a child', async () => {
    const { token, child } = await family();
    const song = await contentBySlug(token, 'moon-song');
    const lock = await ctx.app.inject({ method: 'POST', url: `/children/${child.id}/lock`, headers: bearer(token), payload: { minutes: 30 } });
    expect(lock.json().settings.lockedUntil).toBeTruthy();
    const blocked = await start(token, child.id, song.id);
    expect(blocked.json().error.details.reason).toBe('locked');
    await ctx.app.inject({ method: 'DELETE', url: `/children/${child.id}/lock`, headers: bearer(token) });
    expect((await start(token, child.id, song.id)).statusCode).toBe(201);
  });

  it('only allows calm content at bedtime', async () => {
    const { token, child } = await family();
    // Bedtime window covering the whole day except one minute.
    await ctx.database.db
      .update(children)
      .set({
        settings: {
          ...child.settings,
          bedtimeEnabled: true,
          bedtimeStart: '00:00',
          bedtimeEnd: '23:59',
          lockedUntil: null,
        },
      })
      .where(eq(children.id, child.id));
    const now = new Date();
    if (now.getUTCHours() === 23 && now.getUTCMinutes() === 59) return;
    const game = await contentBySlug(token, 'shape-hunt');
    const story = await contentBySlug(token, 'the-cloud-who-couldnt-sleep');
    expect((await start(token, child.id, game.id)).json().error.details.reason).toBe('bedtime');
    expect((await start(token, child.id, story.id)).statusCode).toBe(201);
  });

  it('does not let another parent play or complete sessions for my child', async () => {
    const a = await family();
    const b = await family();
    const song = await contentBySlug(a.token, 'moon-song');
    expect((await start(b.token, a.child.id, song.id)).statusCode).toBe(403);
    const session = (await start(a.token, a.child.id, song.id)).json<{ id: string }>();
    const res = await ctx.app.inject({
      method: 'POST',
      url: `/sessions/${session.id}/complete`,
      headers: bearer(b.token),
      payload: { seconds: 1, path: [] },
    });
    expect(res.statusCode).toBe(403);
  });
});
