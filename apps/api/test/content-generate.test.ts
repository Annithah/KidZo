import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { AGE_GROUP_RULES, contentInputSchema, publishProblems } from '@kidzo/shared';
import { openDatabase, type Database } from '../src/db/client';
import { content } from '../src/db/schema';
import { loadTopics, videoProblems, type Topic } from '../scripts/content-generate/data';
import { runGenerate, type Renderer } from '../scripts/content-generate/generator';
import { frameSvg, wrap } from '../scripts/content-generate/render';
import type { TtsEngine } from '../scripts/lib/tts';

let database: Database;
let topics: Topic[];
beforeAll(async () => {
  database = await openDatabase({ pgliteDir: 'memory' });
  topics = await loadTopics();
});
afterAll(async () => database.close());

const silent: TtsEngine = { id: 'none', synthesize: async () => undefined };
const fakeRender: Renderer = async (video, _style, _tts, dir) => {
  const files = { p720: path.join(dir, `${video.id}-720.mp4`), p480: path.join(dir, `${video.id}-480.mp4`), thumb: path.join(dir, `${video.id}.jpg`) };
  await Promise.all(Object.values(files).map((f) => writeFile(f, 'x')));
  return { ...files, durationSeconds: 20 + video.scenes.length * 4 };
};
let n = 0;
const storage = { put: async () => ({ key: `g${++n}`, url: `http://localhost:4000/media/g${n}.mp4` }) };

describe('generated learning video data', () => {
  it('has 290+ videos and meets the per-group targets', () => {
    const videos = topics.flatMap((t) => t.videos);
    expect(videos.length).toBeGreaterThanOrEqual(290);
    const count = (g: string) => videos.filter((v) => v.ageGroup === g).length;
    expect(count('little')).toBeGreaterThanOrEqual(100);
    expect(count('young')).toBeGreaterThanOrEqual(100);
    expect(count('big')).toBeGreaterThanOrEqual(90);
  });

  it('covers every topic the brief asks for', () => {
    const names = topics.map((t) => t.topic);
    for (const t of ['counting', 'colors', 'shapes', 'alphabet', 'animal-sounds', 'math', 'science', 'africa-rwanda', 'bedtime', 'kinyarwanda', 'habits']) {
      expect(names).toContain(t);
    }
    expect(topics.find((t) => t.topic === 'bedtime')?.calm).toBe(true);
  });

  it('gives each age group the right number of answers', () => {
    for (const v of topics.flatMap((t) => t.videos)) {
      expect(videoProblems(v)).toEqual([]);
      const rule = AGE_GROUP_RULES[v.ageGroup];
      for (const q of v.quiz) expect(q.options.length).toBeGreaterThanOrEqual(rule.minOptions);
    }
  });

  it('wraps captions and draws calm frames in the night palette', () => {
    expect(wrap('one two three four five six', 9)).toEqual(['one two', 'three', 'four five', 'six']);
    const scene = { art: 'object.moon', say: 'Goodnight & sleep tight <3' };
    const calm = frameSvg(scene, { world: 'grape', calm: true });
    expect(calm).toContain('&amp;');
    expect(calm).toContain('&lt;3');
    expect(calm).not.toBe(frameSvg(scene, { world: 'grape', calm: false }));
  });
});

describe('content generation', () => {
  it('stores videos with quizzes in review, valid for publishing, and never twice', async () => {
    const deps = { db: database.db, storage, tts: silent, render: fakeRender, workDir: os.tmpdir() };
    const first = await runGenerate(topics, deps, { dryRun: false, ids: ['count-to-3', 'times-table-7', 'bedtime-sleepy-moon-little'] });
    expect(first.generated).toBe(3);
    expect(first.failed).toBe(0);

    const rows = await database.db.select().from(content).where(eq(content.type, 'video'));
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row.status).toBe('review');
      expect(row.sourceKey?.startsWith('kidzo:')).toBe(true);
      expect(row.body.kind).toBe('video');
      if (row.body.kind !== 'video') continue;
      expect(row.body.quiz.length).toBeGreaterThan(0);
      expect(row.body.credit.source).toBe('kidzo');
      expect(row.body.captions?.en.length).toBeGreaterThan(5);
      // The stored item must pass the same checks as content saved in the dashboard.
      const parsed = contentInputSchema.parse({ ...row, body: row.body });
      expect(publishProblems(parsed)).toEqual([]);
    }
    const bedtime = rows.find((r) => r.slug === 'kidzo-bedtime-sleepy-moon-little');
    expect(bedtime?.calm).toBe(true);
    expect(bedtime?.ageGroups).toEqual(['little']);

    const again = await runGenerate(topics, deps, { dryRun: false, ids: ['count-to-3', 'times-table-7', 'bedtime-sleepy-moon-little'] });
    expect(again.generated).toBe(0);
    expect(again.existing).toBe(3);
  });

  it('dry run plans without writing and respects the limit', async () => {
    const before = (await database.db.select().from(content)).length;
    const summary = await runGenerate(topics, { db: database.db, storage, tts: silent, render: fakeRender }, { dryRun: true, limit: 10 });
    expect(summary.wouldGenerate).toBe(10);
    expect((await database.db.select().from(content)).length).toBe(before);
  });
});
