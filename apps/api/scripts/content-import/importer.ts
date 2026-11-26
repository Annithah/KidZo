import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { VIDEO_SOURCES, gateFields, type ContentInputParsed, type VideoBody } from '@kidzo/shared';
import type { Db } from '../../src/db/client';
import { content, mediaAssets } from '../../src/db/schema';
import type { MediaStorage } from '../../src/lib/storage';
import { ageRangeFor, assertCategory, cleanTitle, coverColorFor, planEntryBase, slugify } from '../lib/plan-common';
import type { ProbeInfo } from '../lib/media-tools';
import { checkLicense, checkMedia, checkRelevance, checkText, type Rejection } from './safety';
import type { Candidate, VideoSourceAdapter } from './sources';

export const importPlanSchema = z.object({
  /** Results requested per search call. */
  perPage: z.number().int().min(1).max(80).default(30),
  entries: z.array(
    z.object({
      ...planEntryBase,
      terms: z.array(z.string().min(2)).min(1),
      /** NASA is only useful for space and Earth subjects, so it is opt-in per entry. */
      sources: z.array(z.enum(VIDEO_SOURCES)).min(1).default(['pexels', 'pixabay', 'wikimedia']),
      minSeconds: z.number().int().min(5).optional(),
      maxSeconds: z.number().int().min(10).optional(),
      /** Clips to import for this entry. */
      count: z.number().int().min(1).max(200),
      /** Keep the source sound. Off by default: music rights in stock clips are often unclear. */
      keepAudio: z.boolean().default(false),
    }),
  ),
});
export type ImportPlan = z.infer<typeof importPlanSchema>;
export type ImportEntry = ImportPlan['entries'][number];

export interface MediaTools {
  probe(input: string): Promise<ProbeInfo>;
  transcode(input: string, output: string, height: 480 | 720, keepAudio: boolean): Promise<void>;
  thumbnail(input: string, output: string, atSeconds: number): Promise<void>;
}

export interface ImportDeps {
  db: Db;
  storage: MediaStorage;
  media: MediaTools;
  adapters: VideoSourceAdapter[];
  fetchImpl?: typeof fetch;
  log?: (line: string) => void;
  workDir?: string;
}

export interface ImportOptions {
  dryRun: boolean;
  /** Stop after this many imports (or would-be imports in a dry run). */
  limit?: number;
  /** Only these plan entries. */
  only?: string[];
  /** Biggest source file to download, in bytes. */
  maxDownloadBytes?: number;
}

export interface ImportSummary {
  found: number;
  imported: number;
  wouldImport: number;
  duplicates: number;
  failed: number;
  filtered: Record<Rejection['reason'], number>;
  skippedSources: Record<string, string>;
  failures: { id: string; message: string }[];
  items: { entry: string; source: string; originalId: string; title: string; durationSeconds: number | null }[];
}

const sourceKey = (c: Pick<Candidate, 'source' | 'originalId'>) => `${c.source}:${c.originalId}`;

async function download(url: string, file: string, maxBytes: number, f: typeof fetch): Promise<void> {
  const res = await f(url, { headers: { 'user-agent': 'KIDZO-content-import/1.0' } });
  if (!res.ok || !res.body) throw new Error(`download answered ${res.status}`);
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > maxBytes) throw new Error(`file is ${Math.round(declared / 1e6)} MB, over the ${Math.round(maxBytes / 1e6)} MB limit`);
  let seen = 0;
  const body = Readable.fromWeb(res.body as WebReadableStream);
  body.on('data', (chunk: Buffer) => {
    seen += chunk.length;
    if (seen > maxBytes) body.destroy(new Error(`file is over the ${Math.round(maxBytes / 1e6)} MB limit`));
  });
  await pipeline(body, createWriteStream(file));
}

/** Builds the content row for an imported clip. Always status "review": imports are never published. */
export function contentFor(entry: ImportEntry, c: Candidate, body: VideoBody): ContentInputParsed & { status: 'review' } {
  const title = cleanTitle(c.title) || 'Nature clip';
  const groups = entry.ageGroups;
  return {
    slug: `${slugify(title, 48)}-${c.source}-${slugify(c.originalId, 16)}`,
    type: 'video',
    status: 'review',
    title: { en: title },
    summary: { en: (c.description ? cleanTitle(c.description.slice(0, 200)) : `A ${entry.skills[0]} video.`).slice(0, 200) },
    ...ageRangeFor(groups),
    ageGroups: [...groups],
    durationMinutes: Math.max(1, Math.ceil(body.durationSeconds / 60)),
    skills: [...entry.skills],
    languages: ['en'],
    coverArt: entry.art,
    coverColor: coverColorFor(entry.category),
    calm: entry.calm,
    featured: false,
    rewardStars: 5,
    rewardStickerId: null,
    body,
  };
}

/**
 * Runs the plan: search, filter, download, transcode, store, insert as "review".
 * Idempotent: a clip whose source and original id were imported before is skipped.
 */
export async function runImport(plan: ImportPlan, deps: ImportDeps, options: ImportOptions): Promise<ImportSummary> {
  const log = deps.log ?? (() => undefined);
  const f = deps.fetchImpl ?? fetch;
  const summary: ImportSummary = {
    found: 0,
    imported: 0,
    wouldImport: 0,
    duplicates: 0,
    failed: 0,
    filtered: { blocklist: 0, subject: 0, license: 0, duration: 0, resolution: 0 },
    skippedSources: {},
    failures: [],
    items: [],
  };
  const limit = options.limit ?? Infinity;
  const maxBytes = options.maxDownloadBytes ?? 400 * 1024 * 1024;
  const workDir = deps.workDir ?? path.join(os.tmpdir(), 'kidzo-import');
  await mkdir(workDir, { recursive: true });
  const seen = new Set<string>();
  const done = () => summary.imported + summary.wouldImport >= limit;

  const available = deps.adapters.filter((a) => {
    const why = a.unavailable();
    if (why) summary.skippedSources[a.id] = why;
    return !why;
  });
  for (const [id, why] of Object.entries(summary.skippedSources)) log(`Skipping ${id}: ${why}`);

  for (const entry of plan.entries) {
    if (options.only && !options.only.includes(entry.id)) continue;
    assertCategory(entry);
    let taken = 0;
    const adapters = available.filter((a) => entry.sources.includes(a.id));
    for (const term of entry.terms) {
      for (const adapter of adapters) {
        if (taken >= entry.count || done()) break;
        let candidates: Candidate[];
        try {
          candidates = await adapter.search(term, { perPage: plan.perPage, fetchImpl: f });
        } catch (error) {
          summary.failed += 1;
          summary.failures.push({ id: `${adapter.id} search "${term}"`, message: (error as Error).message });
          continue;
        }
        summary.found += candidates.length;
        for (const c of candidates) {
          if (taken >= entry.count || done()) break;
          const key = sourceKey(c);
          if (seen.has(key)) continue;
          seen.add(key);
          const [existing] = await deps.db.select({ id: content.id }).from(content).where(eq(content.sourceKey, key)).limit(1);
          if (existing) {
            summary.duplicates += 1;
            continue;
          }
          const rejected = checkText(c) ?? checkRelevance(c, term) ?? checkLicense(c.license);
          if (rejected) {
            summary.filtered[rejected.reason] += 1;
            continue;
          }
          // Use what the source reports first, to avoid downloading clips that cannot fit.
          if (c.durationSeconds && c.width && c.height) {
            const early = checkMedia({ durationSeconds: c.durationSeconds, width: c.width, height: c.height }, entry.ageGroups, entry);
            if (early) {
              summary.filtered[early.reason] += 1;
              continue;
            }
          }
          if (options.dryRun) {
            summary.wouldImport += 1;
            taken += 1;
            summary.items.push({ entry: entry.id, source: c.source, originalId: c.originalId, title: cleanTitle(c.title), durationSeconds: c.durationSeconds });
            log(`[dry run] ${entry.id}: ${c.source} ${c.originalId} "${cleanTitle(c.title)}"`);
            continue;
          }
          const result = await importOne(entry, c, deps, workDir, maxBytes, f).catch((error: Error) => error);
          if (result instanceof Error) {
            summary.failed += 1;
            summary.failures.push({ id: key, message: result.message });
            log(`Failed ${key}: ${result.message}`);
          } else if ('reason' in result) {
            summary.filtered[result.reason] += 1;
          } else {
            summary.imported += 1;
            taken += 1;
            summary.items.push({ entry: entry.id, source: c.source, originalId: c.originalId, title: result.title, durationSeconds: result.durationSeconds });
            log(`Imported ${entry.id}: ${key} "${result.title}" (${result.durationSeconds}s)`);
          }
        }
      }
    }
  }
  return summary;
}

async function importOne(
  entry: ImportEntry,
  c: Candidate,
  deps: ImportDeps,
  workDir: string,
  maxBytes: number,
  f: typeof fetch,
): Promise<Rejection | { title: string; durationSeconds: number }> {
  const base = path.join(workDir, `${c.source}-${slugify(c.originalId, 40)}`);
  const src = `${base}-source`;
  const files = { p480: `${base}-480.mp4`, p720: `${base}-720.mp4`, thumb: `${base}.jpg` };
  try {
    await download(c.downloadUrl, src, maxBytes, f);
    const info = await deps.media.probe(src);
    const bad = checkMedia(info, entry.ageGroups, entry);
    if (bad) return bad;
    const keepAudio = entry.keepAudio && info.hasAudio;
    await deps.media.transcode(src, files.p480, 480, keepAudio);
    await deps.media.transcode(src, files.p720, 720, keepAudio);
    await deps.media.thumbnail(files.p720, files.thumb, info.durationSeconds * 0.3);

    const put = async (file: string, type: string) => {
      const data = await readFile(file);
      return { ...(await deps.storage.put(data, type)), size: (await stat(file)).size };
    };
    const v480 = await put(files.p480, 'video/mp4');
    const v720 = await put(files.p720, 'video/mp4');
    const thumb = await put(files.thumb, 'image/jpeg');
    const downloadedAt = new Date();
    const body: VideoBody = {
      kind: 'video',
      videoUrl: v720.url,
      variants: { p480: v480.url, p720: v720.url },
      thumbnailUrl: thumb.url,
      durationSeconds: info.durationSeconds,
      audio: keepAudio ? 'original' : 'none',
      captions: null,
      credit: {
        source: c.source,
        sourceUrl: c.sourceUrl,
        originalId: c.originalId,
        author: c.author,
        license: c.license,
        attribution: c.attribution,
        downloadedAt: downloadedAt.toISOString(),
      },
      quiz: [],
    };
    const input = contentFor(entry, c, body);
    await deps.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(content)
        .values({ ...input, ...gateFields(input), sourceKey: sourceKey(c), sizeBytes: v480.size, publishedAt: null })
        .returning({ id: content.id });
      if (!row) throw new Error('could not save content');
      const common = { contentId: row.id, source: c.source, sourceUrl: c.sourceUrl, originalId: c.originalId, author: c.author, license: c.license, attribution: c.attribution, downloadedAt };
      await tx.insert(mediaAssets).values([
        { ...common, role: 'p480', storageKey: v480.key, url: v480.url, contentType: 'video/mp4', sizeBytes: v480.size, height: 480, durationSeconds: info.durationSeconds },
        { ...common, role: 'p720', storageKey: v720.key, url: v720.url, contentType: 'video/mp4', sizeBytes: v720.size, height: 720, durationSeconds: info.durationSeconds },
        { ...common, role: 'thumbnail', storageKey: thumb.key, url: thumb.url, contentType: 'image/jpeg', sizeBytes: thumb.size },
      ]);
    });
    return { title: input.title.en, durationSeconds: info.durationSeconds };
  } finally {
    await Promise.all([src, files.p480, files.p720, files.thumb].map((p) => rm(p, { force: true })));
  }
}
