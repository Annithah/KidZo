/**
 * Age groups decide which content a child may receive. The API enforces them from the
 * child-scoped token; the app never decides on its own.
 */
export const AGE_GROUPS = ['little', 'young', 'big'] as const;
export type AgeGroup = (typeof AGE_GROUPS)[number];

export interface AgeGroupRule {
  label: string;
  minAge: number;
  maxAge: number;
  /** Longest video this group may receive, in seconds. */
  maxVideoSeconds: number;
  /** Shortest video the importer looks for (shorter clips are fine when authored). */
  minVideoSeconds: number;
  /** Answer options per question. */
  minOptions: number;
  maxOptions: number;
  /** Whether questions may run a timer before the child answers. */
  preAnswerTimer: boolean;
}

export const AGE_GROUP_RULES: Record<AgeGroup, AgeGroupRule> = {
  little: { label: 'Little Explorers', minAge: 2, maxAge: 5, maxVideoSeconds: 180, minVideoSeconds: 20, minOptions: 2, maxOptions: 2, preAnswerTimer: false },
  young: { label: 'Young Adventurers', minAge: 6, maxAge: 8, maxVideoSeconds: 360, minVideoSeconds: 60, minOptions: 3, maxOptions: 3, preAnswerTimer: true },
  big: { label: 'Big Explorers', minAge: 9, maxAge: 12, maxVideoSeconds: 720, minVideoSeconds: 120, minOptions: 3, maxOptions: 4, preAnswerTimer: true },
};

export function ageGroupFor(age: number): AgeGroup {
  if (age <= AGE_GROUP_RULES.little.maxAge) return 'little';
  if (age <= AGE_GROUP_RULES.young.maxAge) return 'young';
  return 'big';
}

/** Groups whose ages overlap an item's age range. Used to fill age groups for older content. */
export function ageGroupsForRange(ageMin: number, ageMax: number): AgeGroup[] {
  return AGE_GROUPS.filter((g) => ageMin <= AGE_GROUP_RULES[g].maxAge && ageMax >= AGE_GROUP_RULES[g].minAge);
}

export interface AgeGatedContent {
  ageGroups: readonly string[];
  /** Length of the main video in seconds, for video content. */
  videoSeconds?: number | null;
}

/**
 * True when a child in `group` may receive the item: the item is tagged for the group and,
 * for videos, not longer than the group allows.
 */
export function isForAgeGroup(group: AgeGroup, item: AgeGatedContent): boolean {
  if (!item.ageGroups.includes(group)) return false;
  if (item.videoSeconds != null && item.videoSeconds > AGE_GROUP_RULES[group].maxVideoSeconds) return false;
  return true;
}

/** Header carrying the child-scoped token on kid requests (alongside the parent's login). */
export const CHILD_TOKEN_HEADER = 'x-kidzo-child';

/** A category is shown to an age group only when it has at least this many items for it. */
export const MIN_CATEGORY_ITEMS = 12;
