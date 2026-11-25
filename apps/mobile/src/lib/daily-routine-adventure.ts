import type { BranchingBody, StoryChoice, StoryNode } from '@kidzo/shared';

function node(
  id: string,
  emoji: string,
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
    scene: { emoji, color: '#E8F4FF', videoUrl: null },
    ...(options.videoQuestion ? { videoQuestion: options.videoQuestion } : {}),
    familyTurn: false,
    choices: options.choices ?? [],
    next: options.next ?? null,
    ending: options.ending ?? false,
  };
}

function choice(id: string, label: string, emoji: string, next: string): StoryChoice {
  return { id, label: { en: label }, emoji, next };
}

export const dailyRoutineAdventure: BranchingBody = {
  kind: 'branching',
  startNodeId: 'routine-video',
  nodes: [
    node('routine-video', '🌅', 'What could help make a busy morning feel more predictable?', {
      videoQuestion: { timestampSeconds: 7, defaultChoiceId: 'same-order' },
      choices: [
        choice('same-order', 'Do familiar steps in the same order', '✅', 'routine-win'),
        choice('random-order', 'Change every step each morning', '🔀', 'routine-tip'),
      ],
    }),
    node('routine-win', '🌿', 'Yes! A familiar order can help us know what comes next. Now see how pictures can show the plan.', { next: 'schedule-video' }),
    node('routine-tip', '💡', 'A steady order can make transitions easier. Pictures can also help us see what comes next.', { next: 'schedule-video' }),
    node('schedule-video', '📅', 'What can a picture schedule help us know?', {
      videoQuestion: { timestampSeconds: 7, defaultChoiceId: 'now-and-next' },
      choices: [
        choice('now-and-next', 'What is happening now and what comes next', '👣', 'schedule-win'),
        choice('yesterday', 'Only what we did yesterday', '⏮️', 'schedule-tip'),
        choice('fastest', 'Which game is the fastest', '🏃', 'schedule-tip'),
      ],
    }),
    node('schedule-win', '⭐', 'You got it! A simple “now and next” picture can make a plan easier to follow.', { next: 'communication-video' }),
    node('schedule-tip', '🧩', 'A picture can show the step that comes right after the one we are doing.', { next: 'communication-video' }),
    node('communication-video', '👀', 'Mia points to a butterfly. What helps them share attention?', {
      videoQuestion: { timestampSeconds: 7, defaultChoiceId: 'look-together' },
      choices: [
        choice('look-together', 'Look at the butterfly together', '🫶', 'communication-win'),
        choice('look-away', 'Turn away and do something else', '↩️', 'communication-tip'),
      ],
    }),
    node('communication-win', '💬', 'Yes! Looking together gives them something to notice and talk about.', { next: 'screen-video' }),
    node('communication-tip', '🤝', 'They can connect by looking at the same thing and noticing it together.', { next: 'screen-video' }),
    node('screen-video', '📱', 'After watching a show, what is a healthy next choice?', {
      videoQuestion: { timestampSeconds: 8, defaultChoiceId: 'take-break' },
      choices: [
        choice('take-break', 'Take a break to move or play', '⚽', 'screen-win'),
        choice('keep-watching', 'Keep watching all evening', '📺', 'screen-tip'),
      ],
    }),
    node('screen-win', '🌈', 'Great balance! Movement, play, rest, and time with people all matter.', { next: 'ending' }),
    node('screen-tip', '🌙', 'A screen break makes room for moving, playing, resting, and spending time together.', { next: 'ending' }),
    node('ending', '✨', 'You built a helpful day plan: familiar routines, a picture schedule, shared attention, and balanced screen time. Choose one idea to try with a trusted grown-up.', { ending: true }),
  ],
};
