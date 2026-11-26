import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { ART, parseArtKey } from '@kidzo/art';
import { AGE_GROUPS, AGE_GROUP_RULES, SKILLS, branchingBodySchema, gateFields, validateBranchingBody, type BranchingBody, type ContentInputParsed } from '@kidzo/shared';
import { CATEGORIES, palette } from '@kidzo/ui-tokens';
import type { Db } from '../../src/db/client';
import { content } from '../../src/db/schema';
import { CONTENT_DIR, ageRangeFor, readJsonFile } from '../lib/plan-common';

const artKey = z.string().refine((v) => ART.has(parseArtKey(v).key), { message: 'unknown art key' });

export const adventureSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(2).max(80),
  summary: z.string().min(2).max(200),
  ageGroup: z.enum(AGE_GROUPS),
  skills: z.array(z.enum(SKILLS)).min(1).max(4),
  art: artKey,
  startNodeId: z.string(),
  nodes: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9_-]+$/),
        text: z.string().min(2).max(300),
        art: artKey,
        /** Source key of a clip in the library: kidzo:<video id>, nasa:<id>, wikimedia:<id>, ... */
        video: z.string().optional(),
        next: z.string().optional(),
        ending: z.boolean().optional(),
        choices: z.array(z.object({ id: z.string(), label: z.string().min(1).max(60), art: artKey, next: z.string() })).optional(),
      }),
    )
    .min(2),
});
export type Adventure = z.infer<typeof adventureSchema>;

export const ADVENTURE_DIR = path.join(CONTENT_DIR, 'adventures');

export async function loadAdventures(dir = ADVENTURE_DIR): Promise<Adventure[]> {
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(files.map((f) => readJsonFile(path.join(dir, f), adventureSchema)));
}

/** Choice counts follow the age group (2 for Little, 3 for Young, 3 or 4 for Big). */
export function adventureProblems(a: Adventure): string[] {
  const rule = AGE_GROUP_RULES[a.ageGroup];
  return a.nodes
    .filter((n) => n.choices && (n.choices.length < rule.minOptions || n.choices.length > rule.maxOptions))
    .map((n) => `${a.id}/${n.id}: ${rule.label} need ${rule.minOptions}${rule.maxOptions > rule.minOptions ? ` to ${rule.maxOptions}` : ''} choices, found ${n.choices?.length}`);
}

/**
 * Turns an adventure into a branching body. Every scene is a placeholder until a custom Zo
 * animation replaces its library clip; scenes whose clip is not in the library yet have no video.
 */
export function toBody(a: Adventure, videos: Map<string, string>): { body: BranchingBody; missing: string[] } {
  const world = CATEGORIES.find((c) => c.key === 'magical-adventures')?.world ?? 'grape';
  const missing: string[] = [];
  const body = branchingBodySchema.parse({
    kind: 'branching',
    startNodeId: a.startNodeId,
    nodes: a.nodes.map((n) => {
      const videoUrl = n.video ? (videos.get(n.video) ?? null) : null;
      if (n.video && !videoUrl) missing.push(n.video);
      return {
        id: n.id,
        text: { en: n.text },
        scene: { art: n.art, color: palette[world][100], videoUrl, placeholder: true },
        familyTurn: false,
        choices: (n.choices ?? []).map((c) => ({ id: c.id, label: { en: c.label }, art: c.art, next: c.next })),
        next: n.next ?? null,
        ending: n.ending ?? false,
      };
    }),
  });
  return { body, missing };
}

export interface BuildSummary {
  created: number;
  updated: number;
  skipped: number;
  missingClips: string[];
}

/** Creates or refreshes the adventures (in review). Published adventures are left alone. */
export async function buildAdventures(db: Db, adventures: Adventure[], options: { dryRun: boolean }): Promise<BuildSummary> {
  const summary: BuildSummary = { created: 0, updated: 0, skipped: 0, missingClips: [] };
  const keys = [...new Set(adventures.flatMap((a) => a.nodes.flatMap((n) => (n.video ? [n.video] : []))))];
  const videos = new Map<string, string>();
  for (const key of keys) {
    const [row] = await db.select({ body: content.body }).from(content).where(eq(content.sourceKey, key)).limit(1);
    if (row?.body.kind === 'video') videos.set(key, row.body.videoUrl);
  }
  for (const a of adventures) {
    const { body, missing } = toBody(a, videos);
    const problems = [...adventureProblems(a), ...validateBranchingBody(body)];
    if (problems.length) throw new Error(`Adventure ${a.id}: ${problems.join('; ')}`);
    summary.missingClips.push(...missing.map((m) => `${a.id}: ${m}`));
    const key = `kidzo-adventure:${a.id}`;
    const input: ContentInputParsed & { status: 'review' } = {
      slug: `kidzo-adventure-${a.id}`,
      type: 'adventure',
      status: 'review',
      title: { en: a.title },
      summary: { en: a.summary },
      ...ageRangeFor([a.ageGroup]),
      ageGroups: [a.ageGroup],
      durationMinutes: a.ageGroup === 'little' ? 4 : a.ageGroup === 'young' ? 8 : 12,
      skills: [...a.skills],
      languages: ['en'],
      coverArt: a.art,
      coverColor: palette.grape[400],
      calm: false,
      featured: true,
      rewardStars: 15,
      rewardStickerId: null,
      body,
    };
    const [existing] = await db.select({ id: content.id, status: content.status, version: content.version }).from(content).where(eq(content.sourceKey, key)).limit(1);
    if (options.dryRun) {
      if (existing) summary.updated += 1;
      else summary.created += 1;
      continue;
    }
    if (!existing) {
      await db.insert(content).values({ ...input, ...gateFields(input), sourceKey: key, sizeBytes: JSON.stringify(body).length, publishedAt: null });
      summary.created += 1;
    } else if (existing.status === 'draft' || existing.status === 'review') {
      await db.update(content).set({ body, version: existing.version + 1, updatedAt: new Date() }).where(eq(content.id, existing.id));
      summary.updated += 1;
    } else {
      summary.skipped += 1;
    }
  }
  return summary;
}
