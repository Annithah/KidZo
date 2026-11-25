import { describe, expect, it } from 'vitest';
import { isValidStoryPath, validateBranchingBody } from '@kidzo/shared';
import { dailyRoutineAdventure } from '../daily-routine-adventure';

describe('daily routine adventure', () => {
  it('has a valid branching story with a video chapter for each topic', () => {
    expect(validateBranchingBody(dailyRoutineAdventure)).toEqual([]);
    expect(dailyRoutineAdventure.nodes.map((node) => node.id).filter((id) => id.endsWith('-video'))).toEqual([
      'routine-video',
      'schedule-video',
      'communication-video',
      'screen-video',
    ]);
  });

  it('keeps both supportive and retry answers on valid paths to the ending', () => {
    expect(isValidStoryPath(dailyRoutineAdventure, [
      'routine-video', 'routine-win', 'schedule-video', 'schedule-win', 'communication-video',
      'communication-win', 'screen-video', 'screen-win', 'ending',
    ])).toBe(true);
    expect(isValidStoryPath(dailyRoutineAdventure, [
      'routine-video', 'routine-tip', 'schedule-video', 'schedule-tip', 'communication-video',
      'communication-tip', 'screen-video', 'screen-tip', 'ending',
    ])).toBe(true);
  });

  it('pauses each supplied clip at its configured question time with a safe default', () => {
    const timedScenes = dailyRoutineAdventure.nodes.filter((node) => node.videoQuestion);
    expect(timedScenes).toHaveLength(4);
    expect(timedScenes.every((node) =>
      node.videoQuestion !== undefined && node.videoQuestion.timestampSeconds > 0,
    )).toBe(true);
    expect(timedScenes.every((node) =>
      node.choices.some((choice) => choice.id === node.videoQuestion?.defaultChoiceId),
    )).toBe(true);
  });
});
