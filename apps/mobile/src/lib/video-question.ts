import {
  VIDEO_ANSWER_TIMEOUT_SECONDS,
  type StoryChoice,
  type VideoQuestion,
} from '@kidzo/shared';

export const VIDEO_ANSWER_TIMEOUT_MS = VIDEO_ANSWER_TIMEOUT_SECONDS * 1000;

export function defaultVideoChoice(
  choices: readonly StoryChoice[],
  question: VideoQuestion,
): StoryChoice | undefined {
  return choices.find((choice) => choice.id === question.defaultChoiceId);
}

export function videoQuestionSecondsRemaining(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
