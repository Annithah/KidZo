import { describe, expect, it } from 'vitest';
import { CATEGORY_KEYS, CONTENT_TYPES, SKILLS, categoryOf } from '@kidzo/shared';
import { CATEGORIES, categoryFor } from '@kidzo/ui-tokens';

// Parents block categories by the shared keys while children see the ui-tokens categories.
// If the two ever disagree, a blocked item could still show under another tile.
describe('category definitions', () => {
  it('use the same keys in shared and ui-tokens', () => {
    expect(CATEGORIES.map((c) => c.key)).toEqual([...CATEGORY_KEYS]);
  });

  it('put every type, skill and calm combination in the same category', () => {
    for (const type of CONTENT_TYPES) {
      for (const skill of [...SKILLS, undefined]) {
        for (const calm of [false, true]) {
          const item = { type, calm, skills: skill ? [skill] : [] };
          expect(categoryFor(item).key).toBe(categoryOf(item));
        }
      }
    }
  });
});
