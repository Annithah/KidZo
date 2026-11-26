import { readFile, rm, stat, readdir } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { gateFields, type ContentInputParsed, type QuizQuestion, type VideoBody } from '@kidzo/shared';
import { CATEGORIES, type ColorName } from '@kidzo/ui-tokens';
import type { Db } from '../../src/db/client';
import { content, mediaAssets } from '../../src/db/schema';
import type { MediaStorage } from '../../src/lib/storage';
import { ageRangeFor, coverColorFor } from '../lib/plan-common';
import type { TtsEngine } from '../lib/tts';
import type { GeneratedVideo, Topic } from './data';
import type { RenderedVideo } from './render';

export type Renderer = (video: GeneratedVideo, style: { world: ColorName; calm: boolean }, tts: TtsEngine, workDir: string) => Promise<RenderedVideo>;

export interface GenerateDeps {
  db: Db;
  storage: MediaStorage;
  tts: TtsEngine;
  render: Renderer;
  log?: (line: string) => void;
  workDir?: string;
}

export interface GenerateOptions {
  dryRun: boolean;
  limit?: number;
  /** Only these topics. */
  topics?: string[];
  /** Only these video ids. */
  ids?: string[];
}

export interface GenerateSummary {
  planned: number;
  generated: number;
  wouldGenerate: number;
  existing: number;
  failed: number;
  failures: { id: string; message: string }[];
}

const OPTION_IDS = ['a', 'b', 'c', 'd'];

/** Quiz rows for the database. Options keep their authored order; the answer is stored by id. */
export function toQuiz(v: GeneratedVideo): QuizQuestion[] {
  return v.quiz.map((q, i) => ({
    id: `q${i + 1}`,
    prompt: { en: q.prompt },
    art: q.art,
    options: q.options.map((o, j) => ({ id: OPTION_IDS[j] ?? `o${j}`, label: { en: o.label }, art: o.art })),
    correctOptionId: OPTION_IDS[q.answer] ?? 'a',
    explanation: { en: q.explanation },
  }));
}

/** The content row for a generated video. Always "review": generated items are never auto-published. */
export function generatedContent(topic: Topic, v: GeneratedVideo, body: VideoBody): ContentInputParsed & { status: 'review' } {
  const cover = v.scenes.find((s) => !s.art.startsWith('zo.'))?.art.split('*')[0] ?? topic.art;
  return {
    slug: `kidzo-${v.id}`,
    type: 'video',
    status: 'review',
    title: { en: v.title },
    summary: { en: v.summary },
    ...ageRangeFor([v.ageGroup]),
    ageGroups: [v.ageGroup],
    durationMinutes: Math.max(1, Math.ceil(body.durationSeconds / 60)),
    skills: [...topic.skills],
    languages: ['en'],
    coverArt: cover,
    coverColor: coverColorFor(topic.category),
    calm: topic.calm,
    featured: false,
    rewardStars: 5,
    rewardStickerId: null,
    body,
  };
}

export async function runGenerate(topics: Topic[], deps: GenerateDeps, options: GenerateOptions): Promise<GenerateSummary> {
  const log = deps.log ?? (() => undefined);
  const summary: GenerateSummary = { planned: 0, generated: 0, wouldGenerate: 0, existing: 0, failed: 0, failures: [] };
  const limit = options.limit ?? Infinity;
  const workDir = deps.workDir ?? path.join(os.tmpdir(), 'kidzo-generate');
  await mkdir(workDir, { recursive: true });

  for (const topic of topics) {
    if (options.topics && !options.topics.includes(topic.topic)) continue;
    const world = (CATEGORIES.find((c) => c.key === topic.category)?.world ?? 'sky') as ColorName;
    for (const v of topic.videos) {
      if (options.ids && !options.ids.includes(v.id)) continue;
      if (summary.generated + summary.wouldGenerate >= limit) return summary;
      summary.planned += 1;
      const key = `kidzo:${v.id}`;
      const [existing] = await deps.db.select({ id: content.id }).from(content).where(eq(content.sourceKey, key)).limit(1);
      if (existing) {
        summary.existing += 1;
        continue;
      }
      if (options.dryRun) {
        summary.wouldGenerate += 1;
        continue;
      }
      try {
        const out = await deps.render(v, { world: v.world ?? world, calm: topic.calm }, deps.tts, workDir);
        const put = async (file: string, type: string) => ({ ...(await deps.storage.put(await readFile(file), type)), size: (await stat(file)).size });
        const v720 = await put(out.p720, 'video/mp4');
        const v480 = await put(out.p480, 'video/mp4');
        const thumb = await put(out.thumb, 'image/jpeg');
        const body: VideoBody = {
          kind: 'video',
          videoUrl: v720.url,
          variants: { p480: v480.url, p720: v720.url },
          thumbnailUrl: thumb.url,
          durationSeconds: out.durationSeconds,
          audio: deps.tts.id === 'none' ? 'none' : 'narration',
          captions: { en: v.scenes.map((s) => s.say).join(' ') },
          credit: { source: 'kidzo', sourceUrl: null, originalId: v.id, author: 'KIDZO', license: 'Owned by KIDZO', attribution: 'Made by KIDZO', downloadedAt: null },
          quiz: toQuiz(v),
        };
        const input = generatedContent(topic, v, body);
        await deps.db.transaction(async (tx) => {
          const [row] = await tx
            .insert(content)
            .values({ ...input, ...gateFields(input), sourceKey: key, sizeBytes: v480.size, publishedAt: null })
            .returning({ id: content.id });
          if (!row) throw new Error('could not save content');
          const common = { contentId: row.id, source: 'kidzo', sourceUrl: null, originalId: v.id, author: 'KIDZO', license: 'Owned by KIDZO', attribution: 'Made by KIDZO', downloadedAt: null };
          await tx.insert(mediaAssets).values([
            { ...common, role: 'p720', storageKey: v720.key, url: v720.url, contentType: 'video/mp4', sizeBytes: v720.size, height: 720, durationSeconds: out.durationSeconds },
            { ...common, role: 'p480', storageKey: v480.key, url: v480.url, contentType: 'video/mp4', sizeBytes: v480.size, height: 480, durationSeconds: out.durationSeconds },
            { ...common, role: 'thumbnail', storageKey: thumb.key, url: thumb.url, contentType: 'image/jpeg', sizeBytes: thumb.size },
          ]);
        });
        summary.generated += 1;
        log(`Generated ${v.id} (${v.ageGroup}, ${out.durationSeconds}s)`);
      } catch (error) {
        summary.failed += 1;
        summary.failures.push({ id: v.id, message: (error as Error).message });
        log(`Failed ${v.id}: ${(error as Error).message}`);
      } finally {
        // Remove this video's temporary files.
        for (const f of await readdir(workDir).catch(() => [] as string[])) {
          if (f.startsWith(`${v.id}-`) || f === `${v.id}.jpg`) await rm(path.join(workDir, f), { force: true });
        }
      }
    }
  }
  return summary;
}
