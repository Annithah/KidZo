import { describe, expect, it } from 'vitest';
import { isValidStoryPath, validateBranchingBody } from '@kidzo/shared';
import { kindnessAdventure } from '../kindness-adventure';

describe('kindness adventure', () => {
  it('has a valid, reachable branching story', () => {
    expect(validateBranchingBody(kindnessAdventure)).toEqual([]);
  });

  it('allows different answers to reach the ending', () => {
    expect(isValidStoryPath(kindnessAdventure, ['start', 'reflection', 'helper', 'learn-to-share', 'repair-question', 'tell-truth', 'ending'])).toBe(true);
    expect(isValidStoryPath(kindnessAdventure, ['start', 'ask-helper', 'helper', 'share-kindly', 'repair-question', 'apologize', 'ending'])).toBe(true);
  });
});
