import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { ContentDetail } from '@kidzo/shared';
import { playSessions } from '../src/db/schema';
import { ADMIN, bearer, createChild, createTestApp, login, registerParent, type TestContext } from './helpers';

let ctx: TestContext;
let adminToken: string;

beforeAll(async () => {
  ctx = await createTestApp();
  adminToken = (await login(ctx.app, ADMIN.email, ADMIN.password)).tokens.accessToken;
});
afterAll(async () => ctx.close());

const draft = {
  slug: 'test-adventure',
  type: 'adventure',
  title: { en: 'Test Adventure' },
  summary: { en: 'A tiny test story.' },
  ageMin: 4,
  ageMax: 7,
  durationMinutes: 5,
  skills: ['kindness'],
  languages: ['en'],
  coverEmoji: '🚀',
  coverColor: '#5BC0F8',
  calm: false,
  rewardStars: 10,
  body: {
    kind: 'branching',
    startNodeId: 'a',
    nodes: [
      { id: 'a', text: { en: 'Start' }, scene: { emoji: '🚀', color: '#5BC0F8' }, next: 'b' },
      { id: 'b', text: { en: 'The end' }, scene: { emoji: '🌟', color: '#FFD23F' }, ending: true },
    ],
  },
};

describe('admin access', () => {
  it('rejects parents and anonymous users', async () => {
    const { tokens } = await registerParent(ctx.app);
    expect((await ctx.app.inject({ method: 'GET', url: '/admin/stats', headers: bearer(tokens.accessToken) })).statusCode).toBe(403);
    expect((await ctx.app.inject({ method: 'GET', url: '/admin/stats' })).statusCode).toBe(401);
  });

  it('returns stats', async () => {
    const res = await ctx.app.inject({ method: 'GET', url: '/admin/stats', headers: bearer(adminToken) });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      content: { published: 10 },
      completionRatePercent: 0,
      averagePlaySeconds: 0,
      averageCompletionSeconds: 0,
      topGames: [],
      lowEngagementContent: [],
    });
    expect(res.json().dailyActivity).toHaveLength(7);
  });

  it('reports aggregated engagement and weekly activity', async () => {
    const date = new Date().toISOString().slice(0, 10);
    const before = await ctx.app.inject({ method: 'GET', url: '/admin/stats', headers: bearer(adminToken) });
    const beforeDay = before.json().dailyActivity.find((day: { date: string }) => day.date === date);
    const { tokens } = await registerParent(ctx.app);
    const child = await createChild(ctx.app, tokens.accessToken);
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/admin/content',
      headers: bearer(adminToken),
      payload: { ...draft, slug: 'analytics-adventure' },
    });
    const contentId = created.json().id as string;
    const startedAt = new Date();
    const sessions = [
      { completed: true, secondsPlayed: 60 },
      { completed: true, secondsPlayed: 120 },
      { completed: false, secondsPlayed: 180 },
    ];
    await ctx.database.db.insert(playSessions).values(
      sessions.map((session, index) => ({
        clientSessionId: randomUUID(),
        childId: child.id,
        contentId,
        localDate: startedAt.toISOString().slice(0, 10),
        startedAt: new Date(startedAt.getTime() - index * 1000),
        lastActiveAt: startedAt,
        completed: session.completed,
        secondsPlayed: session.secondsPlayed,
      })),
    );

    const res = await ctx.app.inject({ method: 'GET', url: '/admin/stats', headers: bearer(adminToken) });
    expect(res.statusCode).toBe(200);
    const stats = res.json();
    expect(stats.sessionsLast7Days).toBe(3);
    expect(stats.completionsLast7Days).toBe(2);
    expect(stats.completionRatePercent).toBe(66.7);
    expect(stats.averagePlaySeconds).toBe(120);
    expect(stats.averageCompletionSeconds).toBe(90);
    expect(stats.topContent[0]).toMatchObject({ id: contentId, plays: 3 });
    expect(stats.topSkills).toContainEqual({ skill: 'kindness', plays: 3 });
    expect(stats.lowEngagementContent).toContainEqual({
      id: contentId,
      title: 'Test Adventure',
      plays: 3,
      completionRatePercent: 66.7,
    });
    expect(stats.dailyActivity.find((day: { date: string }) => day.date === date)).toMatchObject({
      newFamilies: beforeDay.newFamilies + 1,
      newChildren: beforeDay.newChildren + 1,
      plays: beforeDay.plays + 3,
      completions: beforeDay.completions + 2,
    });
  });
});

describe('content workflow', () => {
  it('creates a draft, publishes it and shows it in the catalog', async () => {
    const created = await ctx.app.inject({ method: 'POST', url: '/admin/content', headers: bearer(adminToken), payload: draft });
    expect(created.statusCode).toBe(201);
    const item = created.json<ContentDetail & { problems: string[] }>();
    expect(item.status).toBe('draft');
    expect(item.problems).toEqual([]);

    const { tokens } = await registerParent(ctx.app);
    const before = await ctx.app.inject({ method: 'GET', url: `/content/${item.id}`, headers: bearer(tokens.accessToken) });
    expect(before.statusCode).toBe(404);

    const pub = await ctx.app.inject({ method: 'POST', url: `/admin/content/${item.id}/publish`, headers: bearer(adminToken) });
    expect(pub.json().status).toBe('published');
    const after = await ctx.app.inject({ method: 'GET', url: `/content/${item.id}`, headers: bearer(tokens.accessToken) });
    expect(after.statusCode).toBe(200);

    const dupe = await ctx.app.inject({ method: 'POST', url: '/admin/content', headers: bearer(adminToken), payload: draft });
    expect(dupe.statusCode).toBe(409);

    const del = await ctx.app.inject({ method: 'DELETE', url: `/admin/content/${item.id}`, headers: bearer(adminToken) });
    expect(del.statusCode).toBe(400);
  });

  it('blocks publishing broken stories and missing translations', async () => {
    const broken = {
      ...draft,
      slug: 'broken-story',
      languages: ['en', 'fr'],
      body: { ...draft.body, nodes: [{ ...draft.body.nodes[0], next: 'missing' }, draft.body.nodes[1]] },
    };
    const created = await ctx.app.inject({ method: 'POST', url: '/admin/content', headers: bearer(adminToken), payload: broken });
    expect(created.statusCode).toBe(201);
    const problems = created.json<{ problems: string[] }>().problems;
    expect(problems.some((p) => p.includes('missing scene'))).toBe(true);
    expect(problems.some((p) => p.includes('FR'))).toBe(true);
    const pub = await ctx.app.inject({
      method: 'POST',
      url: `/admin/content/${created.json().id}/publish`,
      headers: bearer(adminToken),
    });
    expect(pub.statusCode).toBe(400);
    expect(pub.json().error.code).toBe('PUBLISH_BLOCKED');
  });

  it('bumps the version on update and audits changes', async () => {
    const created = await ctx.app.inject({
      method: 'POST',
      url: '/admin/content',
      headers: bearer(adminToken),
      payload: { ...draft, slug: 'versioned' },
    });
    const id = created.json().id as string;
    const updated = await ctx.app.inject({
      method: 'PUT',
      url: `/admin/content/${id}`,
      headers: bearer(adminToken),
      payload: { ...draft, slug: 'versioned', title: { en: 'Renamed' } },
    });
    expect(updated.json().version).toBe(2);
    const auditLog = await ctx.app.inject({ method: 'GET', url: '/admin/audit', headers: bearer(adminToken) });
    expect(auditLog.json().some((e: { action: string }) => e.action === 'content.update')).toBe(true);
  });
});

describe('media upload', () => {
  const multipart = (filename: string, contentType: string, data: Buffer) => {
    const boundary = '----kidzotest';
    const body = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${contentType}\r\n\r\n`),
      data,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);
    return { body, headers: { 'content-type': `multipart/form-data; boundary=${boundary}` } };
  };

  it('accepts real PNGs and rejects disguised files', async () => {
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
    const good = multipart('cover.png', 'image/png', png);
    const ok = await ctx.app.inject({
      method: 'POST',
      url: '/admin/media',
      headers: { ...bearer(adminToken), ...good.headers },
      payload: good.body,
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json().url).toMatch(/\/media\/.+\.png$/);

    const fake = multipart('evil.png', 'image/png', Buffer.from('<script>alert(1)</script>'));
    const bad = await ctx.app.inject({
      method: 'POST',
      url: '/admin/media',
      headers: { ...bearer(adminToken), ...fake.headers },
      payload: fake.body,
    });
    expect(bad.statusCode).toBe(400);

    const mp4 = Buffer.concat([Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70]), Buffer.from('isom'), Buffer.alloc(64)]);
    const video = multipart('scene.mp4', 'video/mp4', mp4);
    const uploadedVideo = await ctx.app.inject({
      method: 'POST',
      url: '/admin/media',
      headers: { ...bearer(adminToken), ...video.headers },
      payload: video.body,
    });
    expect(uploadedVideo.statusCode).toBe(201);
    expect(uploadedVideo.json()).toMatchObject({ contentType: 'video/mp4' });
    expect(uploadedVideo.json().url).toMatch(/\/media\/.+\.mp4$/);
  });
});
