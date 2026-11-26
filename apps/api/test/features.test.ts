import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ContentDetail, ContentSummary, Recommendation, StoryChoiceInsights } from '@kidzo/shared';
import { ADMIN, asChild, bearer, catalog, createChild, createTestApp, login, registerParent, type TestContext } from './helpers';

let ctx: TestContext;
let adminToken: string;
beforeAll(async () => {
  ctx = await createTestApp();
  adminToken = (await login(ctx.app, ADMIN.email, ADMIN.password)).tokens.accessToken;
});
afterAll(async () => ctx.close());

async function family(age = 6) {
  const { tokens } = await registerParent(ctx.app);
  const child = await createChild(ctx.app, tokens.accessToken, { age });
  await ctx.app.inject({ method: 'PATCH', url: `/children/${child.id}/settings`, headers: bearer(tokens.accessToken), payload: { bedtimeEnabled: false } });
  return { token: tokens.accessToken, child };
}

async function play(token: string, childId: string, item: ContentSummary, path: string[]) {
  const started = await ctx.app.inject({
    method: 'POST',
    url: '/sessions',
    headers: await asChild(ctx.app, token, childId),
    payload: { childId, contentId: item.id, clientSessionId: randomUUID(), familyMode: false },
  });
  expect(started.statusCode).toBe(201);
  const done = await ctx.app.inject({
    method: 'POST',
    url: `/sessions/${started.json().id}/complete`,
    headers: bearer(token),
    payload: { seconds: 30, path },
  });
  expect(done.statusCode).toBe(200);
}

describe('parent category controls', () => {
  it('hides blocked categories from the catalog and refuses to start them', async () => {
    const { token, child } = await family(7);
    const games = (await catalog(ctx.app, token, `?childId=${child.id}`)).filter((c) => c.type === 'game');
    expect(games.length).toBeGreaterThan(0);

    const set = await ctx.app.inject({
      method: 'PATCH',
      url: `/children/${child.id}/settings`,
      headers: bearer(token),
      payload: { blockedCategories: ['brain-games'] },
    });
    expect(set.statusCode).toBe(200);
    expect(set.json().settings.blockedCategories).toEqual(['brain-games']);

    // A later partial update keeps the list.
    const other = await ctx.app.inject({ method: 'PATCH', url: `/children/${child.id}/settings`, headers: bearer(token), payload: { narrationEnabled: false } });
    expect(other.json().settings.blockedCategories).toEqual(['brain-games']);

    const after = await catalog(ctx.app, token, `?childId=${child.id}`);
    expect(after.some((c) => c.type === 'game')).toBe(false);

    const blocked = await ctx.app.inject({
      method: 'POST',
      url: '/sessions',
      headers: await asChild(ctx.app, token, child.id),
      payload: { childId: child.id, contentId: games[0]?.id, clientSessionId: randomUUID(), familyMode: false },
    });
    expect(blocked.statusCode).toBe(403);
    expect(blocked.json().error.details.reason).toBe('category');

    const bad = await ctx.app.inject({ method: 'PATCH', url: `/children/${child.id}/settings`, headers: bearer(token), payload: { blockedCategories: ['nope'] } });
    expect(bad.statusCode).toBe(400);
  });
});

describe('answer feedback setting', () => {
  it('defaults to 5 seconds and only accepts 3, 5 or 8', async () => {
    const { token, child } = await family(6);
    expect(child.settings.feedbackSeconds).toBe(5);
    const patch = (feedbackSeconds: number) =>
      ctx.app.inject({ method: 'PATCH', url: `/children/${child.id}/settings`, headers: bearer(token), payload: { feedbackSeconds } });
    for (const seconds of [3, 8, 5]) {
      const res = await patch(seconds);
      expect(res.statusCode).toBe(200);
      expect(res.json().settings.feedbackSeconds).toBe(seconds);
    }
    expect((await patch(4)).statusCode).toBe(400);
    expect((await patch(0)).statusCode).toBe(400);
  });
});

describe('recommendations and story choice analytics', () => {
  it('recommends by played skills and reports popular choices and endings', async () => {
    const { token, child } = await family(6);
    const items = await catalog(ctx.app, token, `?childId=${child.id}`);
    const adventure = items.find((c) => c.slug === 'zo-and-the-lost-colors');
    if (!adventure) throw new Error('seed adventure missing');
    const detail = (await ctx.app.inject({ method: 'GET', url: `/content/${adventure.id}`, headers: bearer(token) })).json<ContentDetail>();
    if (detail.body.kind !== 'branching') throw new Error('expected branching');
    const body = detail.body;

    // Walk from the start, taking choice `pick` (or the last one) in every choice scene.
    const walk = (pick: number): string[] => {
      const path = [body.startNodeId];
      for (let i = 0; i < 40; i += 1) {
        const node = body.nodes.find((n) => n.id === path[path.length - 1]);
        if (!node || node.ending) break;
        const next = node.choices.length ? (node.choices[Math.min(pick, node.choices.length - 1)]?.next ?? null) : node.next;
        if (!next) break;
        path.push(next);
      }
      return path;
    };
    await play(token, child.id, adventure, walk(0));
    await play(token, child.id, adventure, walk(0));
    await play(token, child.id, adventure, walk(1));

    const recs = await ctx.app.inject({ method: 'GET', url: '/catalog/recommendations', headers: await asChild(ctx.app, token, child.id) });
    expect(recs.statusCode).toBe(200);
    const list = recs.json<Recommendation[]>();
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((r) => r.item.ageMin <= 6)).toBe(true);
    expect(list[0]?.item.id).not.toBe(adventure.id);

    const other = await family(6);
    const forbidden = await ctx.app.inject({ method: 'POST', url: `/children/${child.id}/token`, headers: bearer(other.token) });
    expect(forbidden.statusCode).toBe(403);

    const res = await ctx.app.inject({ method: 'GET', url: '/admin/analytics/story-choices?days=7', headers: bearer(adminToken) });
    expect(res.statusCode).toBe(200);
    const story = res.json<StoryChoiceInsights>().stories.find((s) => s.id === adventure.id);
    expect(story?.paths).toBe(3);
    const first = story?.choices[0];
    expect(first?.reached).toBe(3);
    expect(first?.picks[0]?.count).toBe(2);
    expect(first?.picks[0]?.percent).toBeCloseTo(66.7, 1);
    expect(story?.endings.reduce((n, e) => n + e.count, 0)).toBe(3);

    const parentTry = await ctx.app.inject({ method: 'GET', url: '/admin/analytics/story-choices', headers: bearer(token) });
    expect(parentTry.statusCode).toBe(403);
  });
});
