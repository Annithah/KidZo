import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { AGE_GROUPS, AGE_GROUP_RULES, CATEGORY_KEYS, SKILLS, categoryOf, type AgeGroup } from '@kidzo/shared';
import { CATEGORIES, palette } from '@kidzo/ui-tokens';

/** Repository root, so scripts find content/ wherever they are started from. */
export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
export const CONTENT_DIR = path.join(REPO_ROOT, 'content');

export const planEntryBase = {
  /** Stable id for logs and reports. */
  id: z.string().regex(/^[a-z0-9-]+$/),
  category: z.enum(CATEGORY_KEYS),
  skills: z.array(z.enum(SKILLS)).min(1).max(4),
  ageGroups: z.array(z.enum(AGE_GROUPS)).min(1).max(3),
  /** Bedtime-safe: slow, quiet, night palette. */
  calm: z.boolean().default(false),
  /** Cover art key from the art library. */
  art: z.string().regex(/^[a-z]+\.[a-z0-9-]+(\*[1-9])?$/),
};

/** The category derived from skills and calm must be the one the entry claims. */
export function assertCategory(entry: { id: string; category: string; skills: readonly string[]; calm: boolean }): void {
  const derived = categoryOf({ type: 'video', calm: entry.calm, skills: entry.skills });
  if (derived !== entry.category) {
    throw new Error(`Plan entry "${entry.id}" says category "${entry.category}" but its skills put it in "${derived}". Change the first skill or the category.`);
  }
}

/** Age range covering the chosen groups (2 to 12 at most). */
export function ageRangeFor(groups: readonly AgeGroup[]): { ageMin: number; ageMax: number } {
  return {
    ageMin: Math.min(...groups.map((g) => AGE_GROUP_RULES[g].minAge)),
    ageMax: Math.max(...groups.map((g) => AGE_GROUP_RULES[g].maxAge)),
  };
}

/** Cover color from the category's world color, so imported tiles follow the brand. */
export function coverColorFor(category: string): string {
  const world = CATEGORIES.find((c) => c.key === category)?.world ?? 'sky';
  return palette[world][400];
}

export function slugify(value: string, max = 60): string {
  const s = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '');
  return s || 'clip';
}

/** A short, child-friendly title: no file names, codes or shouting. */
export function cleanTitle(raw: string): string {
  const t = raw
    .replace(/\.(mp4|webm|ogv|mov)$/i, '')
    .replace(/\b[A-Z0-9]{2,}[-_][A-Z0-9_-]+\b/g, ' ')
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const short = t.length > 70 ? `${t.slice(0, 67).replace(/\s+\S*$/, '')}...` : t;
  return short === short.toUpperCase() ? short.charAt(0) + short.slice(1).toLowerCase() : short;
}

export async function readJsonFile<T>(file: string, schema: z.ZodType<T>): Promise<T> {
  const raw = JSON.parse(await readFile(file, 'utf8')) as unknown;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(`${path.relative(REPO_ROOT, file)}: ${issue?.path.join('.')}: ${issue?.message}`);
  }
  return parsed.data;
}
