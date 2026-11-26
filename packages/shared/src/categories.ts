import type { ContentType, Skill } from './schemas/content';

/**
 * Content categories shown to families. The data model stores skills, type and the calm flag;
 * a category is derived from those, so parents can restrict whole areas without per-item tags.
 * Labels, colors and art live in @kidzo/ui-tokens (CATEGORIES), which must use the same keys.
 */
export const CATEGORY_KEYS = [
  'morning-activities',
  'family-fun',
  'magical-adventures',
  'learning',
  'music-dance',
  'brain-games',
  'creative-world',
  'bedtime',
] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

export const SKILL_CATEGORY: Record<Skill, CategoryKey> = {
  problem_solving: 'brain-games',
  kindness: 'family-fun',
  counting: 'learning',
  letters: 'learning',
  colors: 'creative-world',
  shapes: 'learning',
  music: 'music-dance',
  nature: 'morning-activities',
  feelings: 'family-fun',
  creativity: 'creative-world',
  sharing: 'family-fun',
  bravery: 'magical-adventures',
  calm: 'bedtime',
  animals: 'morning-activities',
  science: 'learning',
  math: 'brain-games',
  space: 'magical-adventures',
  geography: 'learning',
  habits: 'morning-activities',
  language: 'learning',
};

export interface CategorizedContent {
  type: ContentType | string;
  calm: boolean;
  skills: readonly string[];
}

/** Category of a content item: calm wins, then its type, then its first skill. */
export function categoryOf(item: CategorizedContent): CategoryKey {
  if (item.calm) return 'bedtime';
  if (item.type === 'game') return 'brain-games';
  if (item.type === 'song') return 'music-dance';
  if (item.type === 'adventure') return 'magical-adventures';
  return SKILL_CATEGORY[(item.skills[0] ?? '') as Skill] ?? 'learning';
}

/** True when a parent has not blocked this item's category for the child. */
export function isCategoryAllowed(blocked: readonly string[] | undefined, item: CategorizedContent): boolean {
  if (!blocked || blocked.length === 0) return true;
  return !blocked.includes(categoryOf(item));
}
