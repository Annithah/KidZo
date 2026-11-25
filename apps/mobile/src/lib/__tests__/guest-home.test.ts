import { describe, expect, it } from 'vitest';
import { firstGuestStory } from '../guest-home';

describe('firstGuestStory', () => {
  it('prefers an adventure over other guest activities', () => {
    const items = [
      { id: 'song', type: 'song' as const },
      { id: 'story', type: 'story' as const },
      { id: 'adventure', type: 'adventure' as const },
    ];

    expect(firstGuestStory(items)).toEqual(items[2]);
  });

  it('uses a story when there are no adventures', () => {
    const items = [{ id: 'story', type: 'story' as const }];

    expect(firstGuestStory(items)).toEqual(items[0]);
  });

  it('returns null when the age-filtered catalog has no stories', () => {
    expect(firstGuestStory([{ id: 'quiz', type: 'game' }])).toBeNull();
  });
});
