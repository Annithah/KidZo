import { describe, expect, it } from 'vitest';
import { blankDraft, liveProblems, nextId, removeNode, withType } from './content-model';

describe('content editor model', () => {
  it('a blank draft only lacks the required text', () => {
    const { schema } = liveProblems(blankDraft());
    expect(schema.length).toBeGreaterThan(0);
    expect(schema.some((p) => p.startsWith('slug'))).toBe(true);
  });

  it('a filled in blank adventure is publishable', () => {
    const draft = blankDraft('adventure');
    draft.slug = 'my-story';
    draft.title = { en: 'My story' };
    draft.summary = { en: 'A story' };
    if (draft.body.kind !== 'branching') throw new Error('expected branching');
    draft.body.nodes = draft.body.nodes.map((n) => ({ ...n, text: { en: 'Hello' } }));
    expect(liveProblems(draft)).toEqual({ schema: [], publish: [] });
  });

  it('flags missing translations for declared languages', () => {
    const draft = blankDraft('song');
    Object.assign(draft, { slug: 'song', title: { en: 'Song' }, summary: { en: 'Sing' }, languages: ['en', 'fr'] });
    if (draft.body.kind !== 'song') throw new Error('expected song');
    draft.body.lines = [{ text: { en: 'La la' }, emoji: '🎵' }];
    const { publish } = liveProblems(draft);
    expect(publish.some((p) => p.includes('FR'))).toBe(true);
  });

  it('switching type swaps the body and clears calm for games', () => {
    const draft = { ...blankDraft('story'), calm: true };
    const game = withType(draft, 'game');
    expect(game.body.kind).toBe('quiz');
    expect(game.calm).toBe(false);
    expect(withType(draft, 'adventure').body).toBe(draft.body);
  });

  it('generates unused ids', () => {
    expect(nextId(['scene-1', 'scene-2'], 'scene')).toBe('scene-3');
    expect(nextId(['scene-3'], 'scene')).toBe('scene-2');
  });

  it('removing a scene removes links to it', () => {
    const body = {
      kind: 'branching' as const,
      startNodeId: 'a',
      nodes: [
        { id: 'a', text: { en: 'A' }, scene: { emoji: 'x', color: '#000000' }, familyTurn: false, next: null, ending: false, choices: [{ id: 'c', label: { en: 'go' }, emoji: 'x', next: 'b' }] },
        { id: 'b', text: { en: 'B' }, scene: { emoji: 'x', color: '#000000' }, familyTurn: false, next: null, ending: true, choices: [] },
      ],
    };
    const result = removeNode(body, 'b');
    expect(result.nodes).toHaveLength(1);
    expect(result.nodes[0]?.choices).toEqual([]);
    expect(removeNode(body, 'a').startNodeId).toBe('b');
  });
});
