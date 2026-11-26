import { ageGroupsForRange, isForAgeGroup, type AgeGroup } from './age-groups';
import { isCategoryAllowed } from './categories';
import type { ContentBody } from './schemas/content';

/** Age groups and video length to store with an item, so the server can gate it cheaply. */
export function gateFields(input: { ageMin: number; ageMax: number; ageGroups?: readonly AgeGroup[]; body: ContentBody }): {
  ageGroups: AgeGroup[];
  videoSeconds: number | null;
} {
  return {
    ageGroups: input.ageGroups && input.ageGroups.length > 0 ? [...input.ageGroups] : ageGroupsForRange(input.ageMin, input.ageMax),
    videoSeconds: input.body.kind === 'video' ? input.body.durationSeconds : null,
  };
}

/**
 * Everything a child-scoped request must pass: the child's age group (including the video
 * length limit) and the parent's blocked categories. Status is checked by the caller.
 */
export function isAllowedForChild(
  child: { age: number; blockedCategories?: readonly string[] },
  group: AgeGroup,
  item: { type: string; calm: boolean; skills: readonly string[]; ageGroups: readonly string[]; videoSeconds?: number | null },
): boolean {
  return isForAgeGroup(group, item) && isCategoryAllowed(child.blockedCategories, item);
}
