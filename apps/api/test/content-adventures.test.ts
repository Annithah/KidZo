import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { validateBranchingBody } from '@kidzo/shared';
import { openDatabase, type Database } from '../src/db/client';
import { content } from '../src/db/schema';
import { adventureProblems, buildAdventures, loadAdventures, toBody, type Adventure } from '../scripts/content-adventures/build';
import { loadTopics } from '../scripts/content-generate/data';

let database: Database;
let adventures: Adventure[];
beforeAll(async () => {
  database = await openDatabase({ pgliteDir: 'memory' });
  adventures = await loadAdventures();
});
afterAll(async () => database.close());

describe('branching adventures', () => {
  it('has three complete adventures per age group', () => {
    for (const g of ['little', 'young', 'big']) expect(adventures.filter((a) => a.ageGroup === g)).toHaveLength(3);
    for (const a of adventures) {
      expect(adventureProblems(a)).toEqual([]);
      expect(validateBranchingBody(toBody(a, new Map()).body)).toEqual([]);
    }
  });

  it('only points at generated videos that exist in the data files', async () => {
    const ids = new Set((await loadTopics()).flatMap((t) => t.videos.map((v) => `kidzo:${v.id}`)));
    const refs = adventures.flatMap((a) => a.nodes.flatMap((n) => (n.video?.startsWith('kidzo:') ? [`${a.id}: ${n.video}`] : [])));
    expect(refs.filter((r) => !ids.has(r.split(': ')[1] ?? ''))).toEqual([]);
  });

  it('builds into review with linked clips and placeholders, and refreshes on a second run', async () => {
    await database.db.insert(content).values({
      slug: 'kidzo-count-to-3',
      type: 'video',
      status: 'published',
      title: { en: 'Count to three' },
      summary: { en: 'Count' },
      ageMin: 2,
      ageMax: 5,
      ageGroups: ['little'],
      durationMinutes: 1,
      skills: ['counting'],
      languages: ['en'],
      coverArt: 'object.apple',
      coverColor: '#4DB8FF',
      rewardStars: 5,
      sourceKey: 'kidzo:count-to-3',
      body: { kind: 'video', videoUrl: 'http://localhost:4000/media/count.mp4', variants: { p480: null, p720: null }, thumbnailUrl: null, durationSeconds: 17, audio: 'narration', captions: null, credit: { source: 'kidzo', sourceUrl: null, originalId: 'count-to-3', author: 'KIDZO', license: 'Owned by KIDZO', attribution: 'Made by KIDZO', downloadedAt: null }, quiz: [] },
    });
    const first = await buildAdventures(database.db, adventures, { dryRun: false });
    expect(first.created).toBe(9);
    const [picnic] = await database.db.select().from(content).where(eq(content.slug, 'kidzo-adventure-counting-picnic'));
    expect(picnic?.status).toBe('review');
    expect(picnic?.ageGroups).toEqual(['little']);
    if (picnic?.body.kind !== 'branching') throw new Error('expected branching');
    const start = picnic.body.nodes.find((n) => n.id === 'start');
    expect(start?.scene.videoUrl).toBe('http://localhost:4000/media/count.mp4');
    expect(picnic.body.nodes.every((n) => n.scene.placeholder)).toBe(true);
    expect(first.missingClips.length).toBeGreaterThan(0);

    const second = await buildAdventures(database.db, adventures, { dryRun: false });
    expect(second.created).toBe(0);
    expect(second.updated).toBe(9);
  });
});
