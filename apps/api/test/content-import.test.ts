import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDatabase, type Database } from '../src/db/client';
import { content, mediaAssets } from '../src/db/schema';
import { importPlanSchema, runImport, type MediaTools } from '../scripts/content-import/importer';
import { checkLicense, checkMedia, checkRelevance, checkText } from '../scripts/content-import/safety';
import { pexels, type Candidate, type VideoSourceAdapter } from '../scripts/content-import/sources';
import { readJsonFile, CONTENT_DIR } from '../scripts/lib/plan-common';

let database: Database;
beforeAll(async () => {
  database = await openDatabase({ pgliteDir: 'memory' });
});
afterAll(async () => database.close());

const candidate = (id: string, over: Partial<Candidate> = {}): Candidate => ({
  source: 'nasa',
  originalId: id,
  title: 'Saturn rings from Cassini',
  description: 'A slow look at the planet Saturn.',
  tags: ['saturn', 'planet'],
  author: 'NASA JPL',
  license: 'Public Domain',
  attribution: 'NASA JPL',
  sourceUrl: `https://images.nasa.gov/details/${id}`,
  downloadUrl: `https://example.test/${id}.mp4`,
  width: null,
  height: null,
  durationSeconds: null,
  ...over,
});

const fakeAdapter = (items: Candidate[]): VideoSourceAdapter => ({ id: 'nasa', unavailable: () => null, search: async () => items });
const fakeFetch = (async () => new Response(new Uint8Array([1, 2, 3]))) as unknown as typeof fetch;
const media = (durationSeconds = 200): MediaTools => ({
  probe: async () => ({ durationSeconds, width: 1920, height: 1080, hasAudio: true }),
  transcode: async (_in, out) => writeFile(out, Buffer.from('mp4')),
  thumbnail: async (_in, out) => writeFile(out, Buffer.from('jpg')),
});
let stored = 0;
const storage = { put: async (_d: Buffer, type: string) => ({ key: `k${++stored}`, url: `http://localhost:4000/media/k${stored}.${type.split('/')[1]}` }) };

const plan = importPlanSchema.parse({
  perPage: 10,
  entries: [{ id: 'space-test', category: 'magical-adventures', skills: ['space'], ageGroups: ['big'], art: 'object.rocket', terms: ['saturn'], sources: ['nasa'], count: 5, minSeconds: 60 }],
});

describe('safety rules', () => {
  it('blocks unsafe words and needs an allowed subject', () => {
    expect(checkText({ title: 'Rocket launch', description: 'Missile test', tags: [] })?.reason).toBe('blocklist');
    expect(checkText({ title: 'Scary night', description: '', tags: ['moon'] })?.reason).toBe('blocklist');
    expect(checkText({ title: 'Quarterly report', description: '', tags: [] })?.reason).toBe('subject');
    expect(checkText({ title: 'Baby elephant plays', description: '', tags: [] })).toBeNull();
    expect(checkText({ title: 'Miserable life of pigs in the farm', description: '', tags: [] })?.reason).toBe('blocklist');
    expect(checkText({ title: 'Harmonized Landsat data: farm fields', description: '', tags: [] })?.reason).toBe('blocklist');
  });

  it('needs the clip to be about the search term', () => {
    expect(checkRelevance({ title: 'Trains departing a station', description: '', tags: [] }, 'farm animals')?.reason).toBe('subject');
    expect(checkRelevance({ title: 'Sheep on a hill', description: '', tags: ['animal'] }, 'farm animals')).toBeNull();
    expect(checkRelevance({ title: 'Ducks on the pond', description: '', tags: [] }, 'ducks pond')).toBeNull();
  });

  it('accepts only open licenses without share-alike, NC or ND', () => {
    for (const ok of ['Public Domain', 'CC0', 'CC BY 4.0', 'Pexels License', 'Pixabay Content License']) expect(checkLicense(ok)).toBeNull();
    for (const bad of ['CC BY-SA 4.0', 'CC BY-NC 4.0', 'CC BY-ND 3.0', 'All rights reserved', 'unknown']) expect(checkLicense(bad)?.reason).toBe('license');
  });

  it('applies the strictest age group length and a 720p minimum', () => {
    expect(checkMedia({ durationSeconds: 200, width: 1280, height: 720 }, ['little'])?.reason).toBe('duration');
    expect(checkMedia({ durationSeconds: 200, width: 1280, height: 720 }, ['young'])).toBeNull();
    expect(checkMedia({ durationSeconds: 200, width: 1280, height: 720 }, ['little', 'young'])?.reason).toBe('duration');
    expect(checkMedia({ durationSeconds: 60, width: 640, height: 360 }, ['young'])?.reason).toBe('resolution');
    expect(checkMedia({ durationSeconds: 30, width: 1920, height: 1080 }, ['big'], { minSeconds: 60 })?.reason).toBe('duration');
  });
});

describe('content import', () => {
  it('imports into review, stores credits and media assets, and never duplicates', async () => {
    const items = [candidate('sat-1'), candidate('sat-2'), candidate('bad-1', { title: 'Explosion test', tags: [] }), candidate('nc-1', { license: 'CC BY-NC 4.0' })];
    const deps = { db: database.db, storage, media: media(), adapters: [fakeAdapter(items)], fetchImpl: fakeFetch, workDir: os.tmpdir() };
    const first = await runImport(plan, deps, { dryRun: false });
    expect(first.imported).toBe(2);
    expect(first.filtered.blocklist).toBe(1);
    expect(first.filtered.license).toBe(1);

    const rows = await database.db.select().from(content).where(eq(content.type, 'video'));
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.status).toBe('review');
      expect(row.publishedAt).toBeNull();
      expect(row.ageGroups).toEqual(['big']);
      expect(row.videoSeconds).toBe(200);
      expect(row.body.kind === 'video' && row.body.credit.license).toBe('Public Domain');
      expect(row.body.kind === 'video' && row.body.audio).toBe('none');
      const assets = await database.db.select().from(mediaAssets).where(eq(mediaAssets.contentId, row.id));
      expect(assets.map((a) => a.role).sort()).toEqual(['p480', 'p720', 'thumbnail']);
    }

    const second = await runImport(plan, deps, { dryRun: false });
    expect(second.imported).toBe(0);
    expect(second.duplicates).toBe(2);
    expect(await database.db.select().from(content).where(eq(content.type, 'video'))).toHaveLength(2);
  });

  it('dry run writes nothing, and --limit stops early', async () => {
    const items = [candidate('dry-1'), candidate('dry-2'), candidate('dry-3')];
    const deps = { db: database.db, storage, media: media(), adapters: [fakeAdapter(items)], fetchImpl: fakeFetch, workDir: os.tmpdir() };
    const before = (await database.db.select().from(content)).length;
    const summary = await runImport(plan, deps, { dryRun: true, limit: 2 });
    expect(summary.wouldImport).toBe(2);
    expect((await database.db.select().from(content)).length).toBe(before);
  });

  it('rejects downloaded clips that are too long for the age group', async () => {
    const deps = { db: database.db, storage, media: media(900), adapters: [fakeAdapter([candidate('long-1')])], fetchImpl: fakeFetch, workDir: os.tmpdir() };
    const summary = await runImport(plan, deps, { dryRun: false });
    expect(summary.imported).toBe(0);
    expect(summary.filtered.duration).toBe(1);
  });

  it('skips a source with a missing key instead of failing', async () => {
    const saved = process.env.PEXELS_API_KEY;
    delete process.env.PEXELS_API_KEY;
    const summary = await runImport(plan, { db: database.db, storage, media: media(), adapters: [pexels], fetchImpl: fakeFetch }, { dryRun: true });
    expect(summary.skippedSources.pexels).toBe('PEXELS_API_KEY is not set');
    expect(summary.wouldImport).toBe(0);
    if (saved) process.env.PEXELS_API_KEY = saved;
  });

  it('ships a valid plan whose categories match the skills', async () => {
    const real = await readJsonFile(path.join(CONTENT_DIR, 'import-plan.json'), importPlanSchema);
    expect(real.entries.length).toBeGreaterThan(20);
    const deps = { db: database.db, storage, media: media(), adapters: [], fetchImpl: fakeFetch };
    await expect(runImport(real, deps, { dryRun: true })).resolves.toBeDefined();
  });
});
