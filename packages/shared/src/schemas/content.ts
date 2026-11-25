import { z } from 'zod';
import { localeSchema, localizedTextSchema } from './common';
import { MAX_AGE, MIN_AGE } from './child';

export const CONTENT_TYPES = ['adventure', 'story', 'song', 'game'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_STATUSES = ['draft', 'published', 'archived'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

export const SKILLS = [
  'problem_solving',
  'kindness',
  'counting',
  'letters',
  'colors',
  'shapes',
  'music',
  'nature',
  'feelings',
  'creativity',
  'sharing',
  'bravery',
  'calm',
] as const;
export type Skill = (typeof SKILLS)[number];

export const SKILL_LABELS: Record<Skill, string> = {
  problem_solving: 'Problem Solving',
  kindness: 'Kindness',
  counting: 'Counting',
  letters: 'Letters',
  colors: 'Colors',
  shapes: 'Shapes',
  music: 'Music',
  nature: 'Nature',
  feelings: 'Feelings',
  creativity: 'Creativity',
  sharing: 'Sharing',
  bravery: 'Bravery',
  calm: 'Calm',
};

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Use a hex color like #FF7A5C');
export const nodeIdSchema = z.string().regex(/^[a-z0-9_-]{1,40}$/, 'Use lowercase letters, numbers, - or _');
const emoji = z.string().min(1).max(16);

export const VIDEO_ANSWER_TIMEOUT_SECONDS = 3;

export const videoQuestionSchema = z.object({
  /** Position in the attached clip at which playback pauses and the question appears. */
  timestampSeconds: z.number().finite().min(0).max(7200),
  /** Choice selected automatically when the child does not answer in three seconds. */
  defaultChoiceId: nodeIdSchema,
});
export type VideoQuestion = z.infer<typeof videoQuestionSchema>;

export const sceneSchema = z.object({
  emoji,
  color: hexColor,
  videoUrl: z.string().url().max(500).nullable().default(null),
});

export const storyChoiceSchema = z.object({
  id: nodeIdSchema,
  label: localizedTextSchema,
  emoji,
  next: nodeIdSchema,
});
export type StoryChoice = z.infer<typeof storyChoiceSchema>;

export const storyNodeSchema = z.object({
  id: nodeIdSchema,
  text: localizedTextSchema,
  scene: sceneSchema,
  /** In Family Mode this node is answered by the grown-up. */
  familyTurn: z.boolean().default(false),
  /** Branching choices. Empty when the node is linear or an ending. */
  choices: z.array(storyChoiceSchema).max(4).default([]),
  /** Linear continuation when there are no choices. */
  next: nodeIdSchema.nullable().default(null),
  /** Pauses the scene video at a timestamp to show choices for three seconds. */
  videoQuestion: videoQuestionSchema.optional(),
  /** Marks a valid ending. */
  ending: z.boolean().default(false),
});
export type StoryNode = z.infer<typeof storyNodeSchema>;

export const branchingBodySchema = z.object({
  kind: z.literal('branching'),
  startNodeId: nodeIdSchema,
  nodes: z.array(storyNodeSchema).min(1).max(200),
});
export type BranchingBody = z.infer<typeof branchingBodySchema>;

export const quizOptionSchema = z.object({
  id: nodeIdSchema,
  label: localizedTextSchema,
  emoji,
});

export const quizQuestionSchema = z.object({
  id: nodeIdSchema,
  prompt: localizedTextSchema,
  emoji,
  options: z.array(quizOptionSchema).min(2).max(4),
  correctOptionId: nodeIdSchema,
});
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const quizBodySchema = z.object({
  kind: z.literal('quiz'),
  questions: z.array(quizQuestionSchema).min(1).max(50),
});
export type QuizBody = z.infer<typeof quizBodySchema>;

export const songLineSchema = z.object({
  text: localizedTextSchema,
  emoji,
});

export const songBodySchema = z.object({
  kind: z.literal('song'),
  /** Optional recorded track. Without it, lyrics are read aloud with gentle narration. */
  audioUrl: z.string().max(500).nullable().default(null),
  lines: z.array(songLineSchema).min(1).max(100),
});
export type SongBody = z.infer<typeof songBodySchema>;

export const contentBodySchema = z.discriminatedUnion('kind', [
  branchingBodySchema,
  quizBodySchema,
  songBodySchema,
]);
export type ContentBody = z.infer<typeof contentBodySchema>;

/** Which body kind each content type uses. */
export const BODY_KIND_FOR_TYPE: Record<ContentType, ContentBody['kind']> = {
  adventure: 'branching',
  story: 'branching',
  song: 'song',
  game: 'quiz',
};

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words joined by hyphens')
  .max(80);

const contentMetaShape = {
  slug: slugSchema,
  type: z.enum(CONTENT_TYPES),
  title: localizedTextSchema,
  summary: localizedTextSchema,
  ageMin: z.number().int().min(MIN_AGE).max(MAX_AGE),
  ageMax: z.number().int().min(MIN_AGE).max(MAX_AGE),
  durationMinutes: z.number().int().min(1).max(120),
  skills: z.array(z.enum(SKILLS)).min(1).max(4),
  languages: z.array(localeSchema).min(1),
  coverEmoji: emoji,
  coverColor: hexColor,
  /** Suitable for bedtime: low stimulation, no games. */
  calm: z.boolean(),
  featured: z.boolean().default(false),
  rewardStars: z.number().int().min(0).max(100),
  rewardStickerId: z.uuid().nullable().default(null),
};

export const contentInputSchema = z
  .object({ ...contentMetaShape, body: contentBodySchema })
  .refine((c) => c.ageMin <= c.ageMax, {
    message: 'Minimum age must not exceed maximum age',
    path: ['ageMax'],
  })
  .refine((c) => BODY_KIND_FOR_TYPE[c.type] === c.body.kind, {
    message: 'Body kind does not match content type',
    path: ['body', 'kind'],
  })
  .refine((c) => !(c.calm && c.type === 'game'), {
    message: 'Games cannot be marked calm',
    path: ['calm'],
  });
export type ContentInput = z.input<typeof contentInputSchema>;
export type ContentInputParsed = z.infer<typeof contentInputSchema>;

export const contentSummarySchema = z.object({
  id: z.uuid(),
  ...contentMetaShape,
  status: z.enum(CONTENT_STATUSES),
  version: z.number().int(),
  sizeBytes: z.number().int(),
  updatedAt: z.string(),
  publishedAt: z.string().nullable(),
});
export type ContentSummary = z.infer<typeof contentSummarySchema>;

export const contentDetailSchema = contentSummarySchema.extend({
  body: contentBodySchema,
});
export type ContentDetail = z.infer<typeof contentDetailSchema>;

export const catalogQuerySchema = z.object({
  childId: z.uuid().optional(),
  type: z.enum(CONTENT_TYPES).optional(),
  calm: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  skill: z.enum(SKILLS).optional(),
});

export const stickerInputSchema = z.object({
  slug: slugSchema,
  name: localizedTextSchema,
  emoji,
  color: hexColor,
});
export type StickerInput = z.infer<typeof stickerInputSchema>;

export const stickerSchema = stickerInputSchema.extend({ id: z.uuid() });
export type Sticker = z.infer<typeof stickerSchema>;

export const childStickerSchema = stickerSchema.extend({ unlockedAt: z.string() });
export type ChildSticker = z.infer<typeof childStickerSchema>;
