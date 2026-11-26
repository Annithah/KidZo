import type { BranchingBody, StoryChoice, StoryNode } from '@kidzo/shared';
import { palette } from '@kidzo/ui-tokens';

function node(
  id: string,
  art: string,
  text: string,
  options: {
    next?: string;
    ending?: boolean;
    choices?: StoryChoice[];
    videoQuestion?: { timestampSeconds: number; defaultChoiceId: string };
  } = {},
): StoryNode {
  return {
    id,
    text: { en: text },
    scene: { art, color: palette.sky[50], videoUrl: null },
    ...(options.videoQuestion ? { videoQuestion: options.videoQuestion } : {}),
    familyTurn: false,
    choices: options.choices ?? [],
    next: options.next ?? null,
    ending: options.ending ?? false,
  };
}

function choice(id: string, label: string, art: string, next: string): StoryChoice {
  return { id, label: { en: label }, art, next };
}

export const dailyRoutineAdventure: BranchingBody = {
  kind: 'branching',
  startNodeId: 'routine-video',
  nodes: [
    node('routine-video', 'object.sun', 'What could help make a busy morning feel more predictable?', {
      videoQuestion: { timestampSeconds: 7, defaultChoiceId: 'same-order' },
      choices: [
        choice('same-order', 'Do familiar steps in the same order', 'object.star', 'routine-win'),
        choice('random-order', 'Change every step each morning', 'object.question', 'routine-tip'),
      ],
    }),
    node('routine-win', 'object.flower', 'Yes! A familiar order can help us know what comes next. Now see how pictures can show the plan.', { next: 'schedule-video' }),
    node('routine-tip', 'object.sparkles', 'A steady order can make transitions easier. Pictures can also help us see what comes next.', { next: 'schedule-video' }),
    node('schedule-video', 'object.book', 'What can a picture schedule help us know?', {
      videoQuestion: { timestampSeconds: 7, defaultChoiceId: 'now-and-next' },
      choices: [
        choice('now-and-next', 'What is happening now and what comes next', 'object.footprints', 'schedule-win'),
        choice('yesterday', 'Only what we did yesterday', 'object.hourglass', 'schedule-tip'),
        choice('fastest', 'Which game is the fastest', 'object.rocket', 'schedule-fast'),
      ],
    }),
    node('schedule-win', 'object.star', 'You got it! A simple “now and next” picture can make a plan easier to follow.', { next: 'communication-video' }),
    node('schedule-tip', 'object.puzzle', 'A picture can show the step that comes right after the one we are doing.', { next: 'communication-video' }),
    node('schedule-fast', 'object.hourglass', 'Being fastest is not the goal. A picture schedule shows what is happening now and what comes next.', { next: 'communication-video' }),
    node('communication-video', 'object.butterfly', 'Mia points to a butterfly. What helps them share attention?', {
      videoQuestion: { timestampSeconds: 7, defaultChoiceId: 'look-together' },
      choices: [
        choice('look-together', 'Look at the butterfly together', 'object.heart', 'communication-win'),
        choice('look-away', 'Turn away and do something else', 'object.question', 'communication-tip'),
      ],
    }),
    node('communication-win', 'object.friends', 'Yes! Looking together gives them something to notice and talk about.', { next: 'screen-video' }),
    node('communication-tip', 'object.friends', 'They can connect by looking at the same thing and noticing it together.', { next: 'screen-video' }),
    node('screen-video', 'object.hourglass', 'After watching a show, what is a healthy next choice?', {
      videoQuestion: { timestampSeconds: 8, defaultChoiceId: 'take-break' },
      choices: [
        choice('take-break', 'Take a break to move or play', 'object.circle', 'screen-win'),
        choice('keep-watching', 'Keep watching all evening', 'object.square', 'screen-tip'),
      ],
    }),
    node('screen-win', 'object.rainbow', 'Great balance! Movement, play, rest, and time with people all matter.', { next: 'ending' }),
    node('screen-tip', 'object.moon', 'A screen break makes room for moving, playing, resting, and spending time together.', { next: 'ending' }),
    node('ending', 'object.sparkles', 'You built a helpful day plan: familiar routines, a picture schedule, shared attention, and balanced screen time. Choose one idea to try with a trusted grown-up.', { ending: true }),
  ],
};
