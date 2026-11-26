import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ContentSummary, Recommendation } from '@kidzo/shared';
import { ADMIN, asChild, bearer, childToken, createChild, createTestApp, login, registerParent, type TestContext } from './helpers';

let ctx: TestContext;
let adminToken: string;
const ids: Record<string, string> = {};

const video = (slug: string, ageGroups: string[], durationSeconds: number, ageMin = 2, ageMax = 12) => ({
  slug,
  type: 'video',
  title: { en: slug },
  summary: { en: 'A test clip.' },
  ageMin,
  ageMax,
  ageGroups,
  durationMinutes: Math.max(1, Math.ceil(durationSeconds / 60)),
  skills: ['animals'],
  languages: ['en'],
  coverArt: 'object.lion',
  coverColor: '#4DB8FF',
  calm: false,
  rewardStars: 5,
  body: {
    kind: 'video',
    videoUrl: `http://localhost:4000/media/${slug}.mp4`,
    durationSeconds,
    credit: { source: 'nasa', sourceUrl: null, originalId: slug, author: null, license: 'Public Domain', attribution: 'NASA', downloadedAt: null },
  },
});

async function publish(input: ReturnType<typeof video>): Promise<string> {
  const created = await ctx.app.inject({ method: 'POST', url: '/admin/content', headers: bearer(adminToken), payload: input });
  if (created.statusCode !== 201) throw new Error(created.body);
  const id = created.json().id as string;
  for (const step of ['submit', 'publish']) {
    const res = await ctx.app.inject({ method: 'POST', url: `/admin/content/${id}/${step}`, headers: bearer(adminToken) });
    if (res.statusCode !== 200) throw new Error(`${step}: ${res.body}`);
  }
  return id;
}

beforeAll(async () => {
  ctx = await createTestApp();
  adminToken = (await login(ctx.app, ADMIN.email, ADMIN.password)).tokens.accessToken;
  ids.little = await publish(video('little-ducks', ['little'], 90));
  ids.big = await publish(video('saturn-rings', ['big'], 400, 9, 12));
  // Tagged for little, but longer than the 3 minute limit for that group.
  ids.longLittle = await publish(video('long-farm-walk', ['little', 'young'], 300));
});
afterAll(async () => ctx.close());

async function littleExplorer() {
  const { tokens } = await registerParent(ctx.app);
  const child = await createChild(ctx.app, tokens.accessToken, { age: 4 });
  await ctx.app.inject({ method: 'PATCH', url: `/children/${child.id}/settings`, headers: bearer(tokens.accessToken), payload: { bedtimeEnabled: false } });
  return { token: tokens.accessToken, child, headers: await asChild(ctx.app, tokens.accessToken, child.id) };
}

describe('age groups on the server', () => {
  it('never gives a Little Explorer Big Explorers content, on any endpoint', async () => {
    const kid = await littleExplorer();
    const list = (await ctx.app.inject({ method: 'GET', url: '/catalog', headers: kid.headers })).json<ContentSummary[]>();
    expect(list.some((c) => c.id === ids.little)).toBe(true);
    expect(list.every((c) => c.ageGroups.includes('little'))).toBe(true);
    expect(list.some((c) => c.id === ids.big)).toBe(false);

    const recs = (await ctx.app.inject({ method: 'GET', url: '/catalog/recommendations?limit=12', headers: kid.headers })).json<Recommendation[]>();
    expect(recs.every((r) => r.item.ageGroups.includes('little'))).toBe(true);
    expect(recs.some((r) => r.item.id === ids.big || r.item.id === ids.longLittle)).toBe(false);

    const byId = await ctx.app.inject({ method: 'GET', url: `/content/${ids.big}`, headers: kid.headers });
    expect(byId.statusCode).toBe(404);

    const play = await ctx.app.inject({
      method: 'POST',
      url: '/sessions',
      headers: kid.headers,
      payload: { childId: kid.child.id, contentId: ids.big, clientSessionId: randomUUID(), familyMode: false },
    });
    expect(play.statusCode).toBe(403);
    expect(play.json().error.details.reason).toBe('age');

    const guest = (await ctx.app.inject({ method: 'POST', url: '/guest/catalog', payload: { age: 4 } })).json<ContentSummary[]>();
    expect(guest.some((c) => c.id === ids.big)).toBe(false);
  });

  it('lists video credits, filtered to the child when a child token is sent', async () => {
    const kid = await littleExplorer();
    const all = await ctx.app.inject({ method: 'GET', url: '/catalog/credits', headers: bearer(kid.token) });
    expect(all.statusCode).toBe(200);
    const parentView = all.json<{ contentId: string; credit: { license: string } }[]>();
    expect(parentView.find((c) => c.contentId === ids.big)?.credit.license).toBe('Public Domain');
    const childView = (await ctx.app.inject({ method: 'GET', url: '/catalog/credits', headers: kid.headers })).json<{ contentId: string }[]>();
    expect(childView.some((c) => c.contentId === ids.little)).toBe(true);
    expect(childView.some((c) => c.contentId === ids.big)).toBe(false);
  });

  it('never returns videos longer than the age group allows', async () => {
    const kid = await littleExplorer();
    const list = (await ctx.app.inject({ method: 'GET', url: '/catalog', headers: kid.headers })).json<ContentSummary[]>();
    expect(list.some((c) => c.id === ids.longLittle)).toBe(false);
    expect((await ctx.app.inject({ method: 'GET', url: `/content/${ids.longLittle}`, headers: kid.headers })).statusCode).toBe(404);

    // The same clip is fine for a 7 year old (6 minute limit).
    const { tokens } = await registerParent(ctx.app);
    const older = await createChild(ctx.app, tokens.accessToken, { age: 7 });
    const olderList = (await ctx.app.inject({ method: 'GET', url: '/catalog', headers: await asChild(ctx.app, tokens.accessToken, older.id) })).json<ContentSummary[]>();
    expect(olderList.some((c) => c.id === ids.longLittle)).toBe(true);
    expect(olderList.some((c) => c.id === ids.big)).toBe(false);
  });

  it('reads the child from the token, not from request parameters', async () => {
    const kid = await littleExplorer();
    const { tokens } = await registerParent(ctx.app);
    const big = await createChild(ctx.app, tokens.accessToken, { age: 10 });

    // Naming another child in the query is refused.
    const swapped = await ctx.app.inject({ method: 'GET', url: `/catalog?childId=${big.id}`, headers: kid.headers });
    expect(swapped.statusCode).toBe(403);
    // Naming a child without a child token is refused.
    const noToken = await ctx.app.inject({ method: 'GET', url: `/catalog?childId=${kid.child.id}`, headers: bearer(kid.token) });
    expect(noToken.statusCode).toBe(401);
    // A child token is not a login.
    const asLogin = await ctx.app.inject({ method: 'GET', url: '/children', headers: bearer(await childToken(ctx.app, kid.token, kid.child.id)) });
    expect(asLogin.statusCode).toBe(401);
    // Another parent's child token does not work with my login.
    const foreign = await ctx.app.inject({ method: 'GET', url: '/catalog', headers: { ...bearer(kid.token), 'x-kidzo-child': await childToken(ctx.app, tokens.accessToken, big.id) } });
    expect(foreign.statusCode).toBe(403);
    // A forged token is rejected.
    const forged = await ctx.app.inject({ method: 'GET', url: '/catalog', headers: { ...bearer(kid.token), 'x-kidzo-child': 'not-a-token' } });
    expect(forged.statusCode).toBe(401);
  });

  it('fills age groups from the age range when none are chosen', async () => {
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/admin/content',
      headers: bearer(adminToken),
      payload: { ...video('range-only', [], 60, 6, 10) },
    });
    expect(created.json().ageGroups).toEqual(['young', 'big']);
  });
});
