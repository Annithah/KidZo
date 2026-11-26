import { describe, expect, it } from 'vitest';
import {
  computeStars,
  contentInputSchema,
  enumerateBranchingPaths,
  formatBytes,
  isValidStoryPath,
  localize,
  publishProblems,
  validateBranchingBody,
  validateQuizBody,
  type BranchingBody,
  type QuizBody,
} from '../src';

const t = (en: string) => ({ en });
const scene = { art: 'object.moon', color: '#24264A', videoUrl: null };

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
        { id: 'sun', label: t('Catch a sunbeam'), art: 'object.sun', next: 'sunny' },
        { id: 'mirror', label: t('Use the magic mirror'), art: 'object.mirror', next: 'mirror' },
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
      art: 'object.question',
      correctOptionId: 'fox',
      options: [
        { id: 'fox', label: t('Little fox'), art: 'object.fox' },
        { id: 'panda', label: t('Red panda'), art: 'object.panda' },
      ],
    },
    {
      id: 'q2',
      prompt: t('How many legs does a cat have?'),
      art: 'object.cat',
      correctOptionId: 'four',
      options: [
        { id: 'two', label: t('Two'), art: 'object.sparkles' },
        { id: 'four', label: t('Four'), art: 'object.sparkles' },
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

  it('enumerates each complete answer route and reports cycles or path caps', () => {
    const routes = enumerateBranchingPaths(story);
    expect(routes.paths).toHaveLength(2);
    expect(routes.paths.map((path) => path.choices[0]?.choiceId)).toEqual(['sun', 'mirror']);
    expect(routes.cycles).toBe(0);
    expect(routes.truncated).toBe(false);
    expect(enumerateBranchingPaths(story, 1).truncated).toBe(true);

    const cyclic: BranchingBody = {
      ...story,
      nodes: story.nodes.map((node) =>
        node.id === 'sunny' ? { ...node, next: 'start' } : node,
      ),
    };
    expect(enumerateBranchingPaths(cyclic).cycles).toBeGreaterThan(0);
  });

  it('requires a timed question default to point to one of the scene choices', () => {
    const timed: BranchingBody = {
      ...story,
      nodes: story.nodes.map((node) =>
        node.id === 'start'
          ? { ...node, videoQuestion: { timestampSeconds: 7, defaultChoiceId: 'sun' } }
          : node,
      ),
    };
    expect(validateBranchingBody(timed)).toEqual([]);
    expect(validateBranchingBody({
      ...timed,
      nodes: timed.nodes.map((node) =>
        node.id === 'start' && node.videoQuestion
          ? { ...node, videoQuestion: { ...node.videoQuestion, defaultChoiceId: 'missing' } }
          : node,
      ),
    })).toContain('Scene "start" default answer "missing" is not one of its choices');
    expect(validateBranchingBody({
      ...story,
      nodes: story.nodes.map((node) =>
        node.id === 'sunny'
          ? { ...node, videoQuestion: { timestampSeconds: 7, defaultChoiceId: 'sun' } }
          : node,
      ),
    })).toContain('Scene "sunny" has a timed video question but no choices');
  });

  it('requires timed answers to lead to different scenes', () => {
    const timed: BranchingBody = {
      ...story,
      nodes: story.nodes.map((node) =>
        node.id === 'start'
          ? {
              ...node,
              videoQuestion: { timestampSeconds: 7, defaultChoiceId: 'sun' },
              choices: node.choices.map((choice) => ({ ...choice, next: 'sunny' })),
            }
          : node,
      ),
    };
    expect(validateBranchingBody(timed)).toContain('Timed video answers in scene "start" must lead to different destination scenes');
  });

  it('blocks publishing a timed question without a video clip', () => {
    const timed: BranchingBody = {
      ...story,
      nodes: story.nodes.map((node) =>
        node.id === 'start'
          ? { ...node, videoQuestion: { timestampSeconds: 7, defaultChoiceId: 'sun' } }
          : node,
      ),
    };
    expect(publishProblems({
      title: t('Garden'),
      summary: t('Explore the garden.'),
      languages: ['en'],
      body: timed,
    })).toContain('Scene "start" has a timed question but no video clip');
  });

  it('requires a separate destination clip for each timed answer branch', () => {
    const timed: BranchingBody = {
      ...story,
      nodes: story.nodes.map((node) =>
        node.id === 'start'
          ? {
              ...node,
              scene: { ...node.scene, videoUrl: 'https://media.example/start.mp4' },
              videoQuestion: { timestampSeconds: 7, defaultChoiceId: 'sun' },
            }
          : node,
      ),
    };
    const problems = publishProblems({
      title: t('Garden'),
      summary: t('Explore the garden.'),
      languages: ['en'],
      body: timed,
    });
    expect(problems).toContain('Answer "sun" from scene "start" needs a video clip on destination scene "sunny"');
    expect(problems).toContain('Answer "mirror" from scene "start" needs a video clip on destination scene "mirror"');
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
    coverArt: 'object.flower',
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
