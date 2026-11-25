import { describe, expect, it } from 'vitest';
import type { StoryChoice } from '@kidzo/shared';
import { defaultVideoChoice, VIDEO_ANSWER_TIMEOUT_MS, videoQuestionSecondsRemaining } from '../video-question';

const choices: StoryChoice[] = [
  { id: 'brush', label: { en: 'Brush teeth' }, emoji: '🪥', next: 'brush-scene' },
  { id: 'breakfast', label: { en: 'Eat breakfast' }, emoji: '🍎', next: 'breakfast-scene' },
];

describe('timed video questions', () => {
  it('uses the configured default choice and never invents a fallback', () => {
    expect(defaultVideoChoice(choices, { timestampSeconds: 7, defaultChoiceId: 'breakfast' })).toEqual(choices[1]);
    expect(defaultVideoChoice(choices, { timestampSeconds: 7, defaultChoiceId: 'missing' })).toBeUndefined();
  });

  it('uses an exact three-second deadline and a child-readable countdown', () => {
    expect(VIDEO_ANSWER_TIMEOUT_MS).toBe(3000);
    expect(videoQuestionSecondsRemaining(10_000, 7_000)).toBe(3);
    expect(videoQuestionSecondsRemaining(10_000, 8_001)).toBe(2);
    expect(videoQuestionSecondsRemaining(10_000, 9_001)).toBe(1);
    expect(videoQuestionSecondsRemaining(10_000, 10_000)).toBe(0);
    expect(videoQuestionSecondsRemaining(10_000, 10_200)).toBe(0);
  });
});
