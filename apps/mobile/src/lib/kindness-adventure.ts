import type { BranchingBody, StoryChoice, StoryNode } from '@kidzo/shared';
import { palette } from '@kidzo/ui-tokens';

function node(
  id: string,
  art: string,
  text: string,
  options: { next?: string; ending?: boolean; choices?: StoryChoice[] } = {},
): StoryNode {
  return {
    id,
    text: { en: text },
    scene: { art, color: palette.sky[200], videoUrl: null },
    familyTurn: false,
    choices: options.choices ?? [],
    next: options.next ?? null,
    ending: options.ending ?? false,
  };
}

function choice(id: string, label: string, art: string, next: string): StoryChoice {
  return { id, label: { en: label }, art, next };
}

export const kindnessAdventure: BranchingBody = {
  kind: 'branching',
  startNodeId: 'start',
  nodes: [
    node('start', 'object.friends', 'Tom and Mia are playing in the park when they notice a little puppy alone beside a bag. They stay back. What should they do?', {
      choices: [
        choice('ask', 'Ask a trusted adult for help', 'object.wave-hand', 'ask-helper'),
        choice('think', 'Walk away, then think again', 'object.question', 'reflection'),
        choice('take', 'Take the puppy home', 'object.house', 'safe-choice'),
      ],
    }),
    node('ask-helper', 'object.wave-hand', 'Tom and Mia keep a safe distance and tell the park helper they found a puppy.', { next: 'helper' }),
    node('reflection', 'object.question', 'They start to leave, then wonder if the puppy’s family is worried. They decide to find a trusted adult.', { next: 'helper' }),
    node('safe-choice', 'object.heart', 'Tom thinks about taking the puppy home, but Mia reminds him not to handle an unfamiliar animal. They ask the helper.', { next: 'helper' }),
    node('helper', 'object.friends', 'The helper checks the puppy safely and contacts its family. While they wait, how can Tom and Mia be good friends?', {
      choices: [
        choice('share', 'Share and take turns', 'object.gift', 'share-kindly'),
        choice('grab', 'Grab the toys first', 'object.wave-hand', 'learn-to-share'),
        choice('include', 'Leave someone out', 'object.question', 'include-friend'),
      ],
    }),
    node('share-kindly', 'object.gift', 'They share the toys and take turns. Everyone gets to join the game.', { next: 'repair-question' }),
    node('learn-to-share', 'object.wave-hand', 'Grabbing makes Mia feel left out. Tom pauses and offers to take turns.', { next: 'repair-question' }),
    node('include-friend', 'object.heart', 'Mia notices a friend waiting nearby and invites them to play too.', { next: 'repair-question' }),
    node('repair-question', 'object.puzzle', 'Tom accidentally knocks over Mia’s block tower. What is the kind and honest thing to do?', {
      choices: [
        choice('apologize', 'Tell the truth, say sorry, and help rebuild', 'object.heart', 'apologize'),
        choice('blame', 'Blame someone else', 'object.question', 'tell-truth'),
        choice('walk', 'Walk away', 'object.footprints', 'make-it-right'),
      ],
    }),
    node('apologize', 'object.heart', 'Tom tells the truth, says sorry, and helps Mia rebuild the tower.', { next: 'ending' }),
    node('tell-truth', 'object.question', 'Tom sees that blaming someone else is unfair. He tells the truth and helps Mia rebuild.', { next: 'ending' }),
    node('make-it-right', 'object.puzzle', 'Tom sees that walking away does not fix things. He apologizes and helps Mia rebuild.', { next: 'ending' }),
    node('ending', 'object.star', 'The puppy is reunited with its happy family. Tom and Mia celebrate: they stayed safe, asked for help, and treated each other kindly.', { ending: true }),
  ],
};
