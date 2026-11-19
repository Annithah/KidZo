import { describe, expect, it } from 'vitest';
import {
  computeStars,
  contentInputSchema,
  formatBytes,
  isValidStoryPath,
  localize,
  validateBranchingBody,
  validateQuizBody,
  type BranchingBody,
  type QuizBody,
} from '../src';

const t = (en: string) => ({ en });
const scene = { emoji: '🌙', color: '#24264A', videoUrl: null };

const story: BranchingBody = {
  kind: 'branching',
  startNodeId: 'start',
  nodes: [
    {
      id: 'start',
      text: t('The garden is sleepy.'),
      scene,
      familyTurn: false,
      next: null,
      ending: false,
      choices: [
        { id: 'sun', label: t('Catch a sunbeam'), emoji: '☀️', next: 'sunny' },
        { id: 'mirror', label: t('Use the magic mirror'), emoji: '🪞', next: 'mirror' },
      ],
    },
    { id: 'sunny', text: t('Flowers wake up!'), scene, familyTurn: false, choices: [], next: 'end', ending: false },
    { id: 'mirror', text: t('Light bounces!'), scene, familyTurn: false, choices: [], next: 'end', ending: false },
    { id: 'end', text: t('The garden blooms.'), scene, familyTurn: false, choices: [], next: null, ending: true },
  ],
};

const quiz: QuizBody = {
  kind: 'quiz',
  questions: [
    {
      id: 'q1',
      prompt: t('Who has a bushy red tail?'),
      emoji: '❓',
      correctOptionId: 'fox',
      options: [
        { id: 'fox', label: t('Little fox'), emoji: '🦊' },
        { id: 'panda', label: t('Red panda'), emoji: '🐼' },
      ],
    },
    {
      id: 'q2',
      prompt: t('How many legs does a cat have?'),
      emoji: '🐱',
      correctOptionId: 'four',
      options: [
        { id: 'two', label: t('Two'), emoji: '2️⃣' },
        { id: 'four', label: t('Four'), emoji: '4️⃣' },
      ],
    },
  ],
};

describe('branching validation', () => {
  it('accepts a well formed story', () => {
    expect(validateBranchingBody(story)).toEqual([]);
  });

  it('reports a missing target', () => {
    const broken: BranchingBody = {
      ...story,
      nodes: story.nodes.map((n) => (n.id === 'sunny' ? { ...n, next: 'nowhere' } : n)),
    };
    expect(validateBranchingBody(broken).join()).toMatch(/missing scene "nowhere"/);
  });

  it('reports unreachable scenes and missing endings', () => {
    const orphan: BranchingBody = {
      ...story,
      nodes: [...story.nodes, { id: 'lost', text: t('Lost'), scene, familyTurn: false, choices: [], next: null, ending: true }],
    };
    expect(validateBranchingBody(orphan)).toContain('Scene "lost" can never be reached');
  });

  it('rejects scenes that mix choices and a next scene', () => {
    const mixed: BranchingBody = {
      ...story,
      nodes: story.nodes.map((n) => (n.id === 'start' ? { ...n, next: 'end' } : n)),
    };
    expect(validateBranchingBody(mixed).join()).toMatch(/exactly one of/);
  });

  it('checks story paths', () => {
    expect(isValidStoryPath(story, ['start', 'sunny', 'end'])).toBe(true);
    expect(isValidStoryPath(story, ['start', 'end'])).toBe(false);
    expect(isValidStoryPath(story, ['start', 'sunny'])).toBe(false);
    expect(isValidStoryPath(story, [])).toBe(false);
  });
});

describe('quiz validation and stars', () => {
  it('validates the correct option exists', () => {
    expect(validateQuizBody(quiz)).toEqual([]);
    const bad: QuizBody = { kind: 'quiz', questions: [{ ...quiz.questions[0]!, correctOptionId: 'owl' }] };
    expect(validateQuizBody(bad)).toHaveLength(1);
  });

  it('rewards effort and accuracy', () => {
    expect(computeStars(quiz, 10, [], { q1: 'fox', q2: 'four' })).toEqual({ valid: true, stars: 10 });
    expect(computeStars(quiz, 10, [], { q1: 'fox', q2: 'two' })).toEqual({ valid: true, stars: 5 });
    expect(computeStars(quiz, 10, [], { q1: 'panda', q2: 'two' })).toEqual({ valid: true, stars: 1 });
    expect(computeStars(quiz, 10, [], { q1: 'fox' })).toEqual({ valid: false, stars: 0 });
  });

  it('rewards stories only for legal endings', () => {
    expect(computeStars(story, 30, ['start', 'mirror', 'end'], undefined).stars).toBe(30);
    expect(computeStars(story, 30, ['start', 'end'], undefined).stars).toBe(0);
  });
});

describe('content input schema', () => {
  const valid = {
    slug: 'secret-sky-garden',
    type: 'adventure' as const,
    title: t('The Secret Sky Garden'),
    summary: t('Fly above the clouds.'),
    ageMin: 5,
    ageMax: 8,
    durationMinutes: 18,
    skills: ['problem_solving' as const],
    languages: ['en' as const],
    coverEmoji: '🌸',
    coverColor: '#5BC0F8',
    calm: false,
    rewardStars: 30,
    body: story,
  };

  it('accepts valid content and applies defaults', () => {
    const parsed = contentInputSchema.parse(valid);
    expect(parsed.featured).toBe(false);
    expect(parsed.rewardStickerId).toBeNull();
  });

  it('rejects mismatched body kinds, bad ages and calm games', () => {
    expect(contentInputSchema.safeParse({ ...valid, type: 'game' }).success).toBe(false);
    expect(contentInputSchema.safeParse({ ...valid, ageMin: 9 }).success).toBe(false);
    expect(contentInputSchema.safeParse({ ...valid, type: 'game', calm: true, body: quiz }).success).toBe(false);
    expect(contentInputSchema.safeParse({ ...valid, slug: 'Bad Slug' }).success).toBe(false);
  });
});

describe('formatting', () => {
  it('localizes with English fallback', () => {
    expect(localize({ en: 'Hello', fr: 'Bonjour' }, 'fr')).toBe('Bonjour');
    expect(localize({ en: 'Hello' }, 'rw')).toBe('Hello');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(186 * 1024 * 1024)).toBe('186 MB');
  });
});
