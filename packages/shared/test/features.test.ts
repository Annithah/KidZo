import { describe, expect, it } from 'vitest';
import {
  categoryOf,
  childSettingsSchema,
  DEFAULT_CHILD_SETTINGS,
  evaluatePlayPolicy,
  isCategoryAllowed,
  normalizeChildSettings,
  recapFromPath,
  recommendContent,
  summarizeStoryPaths,
  updateChildSettingsSchema,
  type BranchingBody,
} from '../src';

const story: BranchingBody = {
  kind: 'branching',
  startNodeId: 'start',
  nodes: [
    {
      id: 'start',
      text: { en: 'Which way?' },
      scene: { art: 'object.star', color: '#4DB8FF', videoUrl: null },
      familyTurn: false,
      next: null,
      ending: false,
      choices: [
        { id: 'left', label: { en: 'Left' }, art: 'object.sun', next: 'forest' },
        { id: 'right', label: { en: 'Right' }, art: 'object.moon', next: 'beach' },
      ],
    },
    { id: 'forest', text: { en: 'Trees' }, scene: { art: 'object.flower', color: '#34C99A', videoUrl: null }, familyTurn: false, next: 'end-forest', ending: false, choices: [] },
    { id: 'beach', text: { en: 'Sand' }, scene: { art: 'object.beach', color: '#FFC83D', videoUrl: null }, familyTurn: false, next: null, ending: true, choices: [] },
    { id: 'end-forest', text: { en: 'Home' }, scene: { art: 'object.house', color: '#34C99A', videoUrl: null }, familyTurn: false, next: null, ending: true, choices: [] },
  ],
};

describe('categories', () => {
  it('derives a category from calm, type, then first skill', () => {
    expect(categoryOf({ type: 'game', calm: false, skills: ['counting'] })).toBe('brain-games');
    expect(categoryOf({ type: 'story', calm: true, skills: ['counting'] })).toBe('bedtime');
    expect(categoryOf({ type: 'story', calm: false, skills: ['counting'] })).toBe('learning');
    expect(categoryOf({ type: 'story', calm: false, skills: [] })).toBe('learning');
  });

  it('blocks only the chosen categories', () => {
    expect(isCategoryAllowed(['brain-games'], { type: 'game', calm: false, skills: [] })).toBe(false);
    expect(isCategoryAllowed(['brain-games'], { type: 'song', calm: false, skills: [] })).toBe(true);
    expect(isCategoryAllowed(undefined, { type: 'game', calm: false, skills: [] })).toBe(true);
  });

  it('keeps older stored settings valid and never resets the list on a partial update', () => {
    const { blockedCategories: _omit, ...legacy } = DEFAULT_CHILD_SETTINGS;
    expect(childSettingsSchema.parse(legacy).blockedCategories).toEqual([]);
    expect(normalizeChildSettings(legacy).blockedCategories).toEqual([]);
    expect(updateChildSettingsSchema.parse({ narrationEnabled: false })).not.toHaveProperty('blockedCategories');
    expect(() => updateChildSettingsSchema.parse({ blockedCategories: ['not-a-category'] })).toThrow();
  });

  it('play policy refuses content in a blocked category', () => {
    const base = { secondsPlayedToday: 0, now: new Date('2026-11-25T12:00:00Z'), timeZone: 'UTC', childAge: 7 };
    const settings = { ...DEFAULT_CHILD_SETTINGS, bedtimeEnabled: false, blockedCategories: ['brain-games' as const] };
    expect(evaluatePlayPolicy({ ...base, settings, content: { calm: false, ageMin: 3, type: 'game', skills: [] } }).reason).toBe('category');
    expect(evaluatePlayPolicy({ ...base, settings, content: { calm: false, ageMin: 3, type: 'song', skills: [] } }).allowed).toBe(true);
  });
});

describe('story paths', () => {
  it('counts choices and endings and ignores broken paths', () => {
    const summary = summarizeStoryPaths(story, [
      ['start', 'forest', 'end-forest'],
      ['start', 'forest', 'end-forest'],
      ['start', 'beach'],
      ['elsewhere', 'beach'],
      ['start', 'nowhere'],
    ]);
    expect(summary.paths).toBe(4);
    expect(summary.endings).toEqual([
      { nodeId: 'end-forest', count: 2 },
      { nodeId: 'beach', count: 1 },
    ]);
    expect(summary.choices).toEqual([
      { nodeId: 'start', reached: 4, picks: [{ choiceId: 'left', count: 2 }, { choiceId: 'right', count: 1 }] },
    ]);
  });

  it('builds a recap with the choice made in each scene', () => {
    const recap = recapFromPath(story, ['start', 'beach']);
    expect(recap.map((s) => [s.node.id, s.choice?.id ?? null])).toEqual([
      ['start', 'right'],
      ['beach', null],
    ]);
    expect(recapFromPath(story, ['start', 'ghost'])).toHaveLength(1);
  });
});

describe('recommendations', () => {
  const item = (id: string, type: string, skills: string[], extra: Partial<{ calm: boolean; ageMin: number; ageMax: number; featured: boolean }> = {}) => ({
    id,
    type,
    skills,
    calm: false,
    ageMin: 3,
    ageMax: 8,
    featured: false,
    ...extra,
  });
  const catalog = [
    item('count-game', 'game', ['counting']),
    item('count-story', 'story', ['counting']),
    item('song', 'song', ['music'], { featured: true }),
    item('teen', 'story', ['counting'], { ageMin: 11, ageMax: 12 }),
  ];

  it('ranks by the skills a child finished and skips age and blocked mismatches', () => {
    const picks = recommendContent({ age: 6, blockedCategories: ['brain-games'] }, catalog, [{ contentId: 'count-game', completed: true }]);
    const ids = picks.map((p) => p.item.id);
    expect(ids[0]).toBe('count-story');
    expect(picks[0]?.becauseSkill).toBe('counting');
    expect(ids).not.toContain('count-game');
    expect(ids).not.toContain('teen');
  });

  it('falls back to featured items for a new child', () => {
    const picks = recommendContent({ age: 6 }, catalog, []);
    expect(picks[0]?.item.id).toBe('song');
    expect(picks[0]?.becauseSkill).toBeNull();
  });
});
