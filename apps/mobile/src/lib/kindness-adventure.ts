import type { BranchingBody, StoryChoice, StoryNode } from '@kidzo/shared';

function node(
  id: string,
  emoji: string,
  text: string,
  options: { next?: string; ending?: boolean; choices?: StoryChoice[] } = {},
): StoryNode {
  return {
    id,
    text: { en: text },
    scene: { emoji, color: '#A8E5FF', videoUrl: null },
    familyTurn: false,
    choices: options.choices ?? [],
    next: options.next ?? null,
    ending: options.ending ?? false,
  };
}

function choice(id: string, label: string, emoji: string, next: string): StoryChoice {
  return { id, label: { en: label }, emoji, next };
}

export const kindnessAdventure: BranchingBody = {
  kind: 'branching',
  startNodeId: 'start',
  nodes: [
    node('start', '🎒', 'Tom and Mia are playing in the park when they notice a little puppy alone beside a bag. They stay back. What should they do?', {
      choices: [
        choice('ask', 'Ask a trusted adult for help', '🙋', 'ask-helper'),
        choice('think', 'Walk away, then think again', '💭', 'reflection'),
        choice('take', 'Take the puppy home', '🏠', 'safe-choice'),
      ],
    }),
    node('ask-helper', '👋', 'Tom and Mia keep a safe distance and tell the park helper they found a puppy.', { next: 'helper' }),
    node('reflection', '💭', 'They start to leave, then wonder if the puppy’s family is worried. They decide to find a trusted adult.', { next: 'helper' }),
    node('safe-choice', '🛑', 'Tom thinks about taking the puppy home, but Mia reminds him not to handle an unfamiliar animal. They ask the helper.', { next: 'helper' }),
    node('helper', '📞', 'The helper checks the puppy safely and contacts its family. While they wait, how can Tom and Mia be good friends?', {
      choices: [
        choice('share', 'Share and take turns', '🧸', 'share-kindly'),
        choice('grab', 'Grab the toys first', '✋', 'learn-to-share'),
        choice('include', 'Leave someone out', '🙁', 'include-friend'),
      ],
    }),
    node('share-kindly', '🧸', 'They share the toys and take turns. Everyone gets to join the game.', { next: 'repair-question' }),
    node('learn-to-share', '✋', 'Grabbing makes Mia feel left out. Tom pauses and offers to take turns.', { next: 'repair-question' }),
    node('include-friend', '🫶', 'Mia notices a friend waiting nearby and invites them to play too.', { next: 'repair-question' }),
    node('repair-question', '🧱', 'Tom accidentally knocks over Mia’s block tower. What is the kind and honest thing to do?', {
      choices: [
        choice('apologize', 'Tell the truth, say sorry, and help rebuild', '💛', 'apologize'),
        choice('blame', 'Blame someone else', '👉', 'tell-truth'),
        choice('walk', 'Walk away', '🚶', 'make-it-right'),
      ],
    }),
    node('apologize', '💛', 'Tom tells the truth, says sorry, and helps Mia rebuild the tower.', { next: 'ending' }),
    node('tell-truth', '👉', 'Tom sees that blaming someone else is unfair. He tells the truth and helps Mia rebuild.', { next: 'ending' }),
    node('make-it-right', '🧩', 'Tom sees that walking away does not fix things. He apologizes and helps Mia rebuild.', { next: 'ending' }),
    node('ending', '⭐', 'The puppy is reunited with its happy family. Tom and Mia celebrate: they stayed safe, asked for help, and treated each other kindly.', { ending: true }),
  ],
};
