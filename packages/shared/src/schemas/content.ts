import { z } from 'zod';
import { localeSchema, localizedTextSchema } from './common';
import { MAX_AGE, MIN_AGE } from './child';
import { AGE_GROUPS } from '../age-groups';

export const CONTENT_TYPES = ['adventure', 'story', 'song', 'game', 'video'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

/**
 * Editorial workflow: draft -> review -> published. Unpublishing moves live content to
 * "unpublished" (approved before, hidden now); it can be republished without another review.
 */
export const CONTENT_STATUSES = ['draft', 'review', 'published', 'unpublished', 'archived'] as const;
export type ContentStatus = (typeof CONTENT_STATUSES)[number];

/** Statuses from which content may be published. Drafts must be submitted for review first. */
export const PUBLISHABLE_STATUSES: readonly ContentStatus[] = ['review', 'unpublished'];

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
  'animals',
  'science',
  'math',
  'space',
  'geography',
  'habits',
  'language',
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
  animals: 'Animals',
  science: 'Science',
  math: 'Math',
  space: 'Space',
  geography: 'Geography',
  habits: 'Good Habits',
  language: 'Language',
};

const hexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Pick a color from the color picker');
export const nodeIdSchema = z.string().regex(/^[a-z0-9_-]{1,40}$/, 'Use lowercase letters, numbers, - or _');
/** Key into the KIDZO art library, for example "object.moon", "sticker.ocean-pearl" or "object.apple*3". */
export const artKeySchema = z
  .string()
  .max(60)
  .regex(/^[a-z]+(\.[a-z0-9-]+)+(\*[1-9])?$/, 'Pick a picture from the art library');
const art = artKeySchema;

export const VIDEO_ANSWER_TIMEOUT_SECONDS = 3;

export const videoQuestionSchema = z.object({
  /** Position in the attached clip at which playback pauses and the question appears. */
  timestampSeconds: z.number().finite().min(0).max(7200),
  /** Choice selected automatically when the child does not answer in three seconds. */
  defaultChoiceId: nodeIdSchema,
});
export type VideoQuestion = z.infer<typeof videoQuestionSchema>;

export const sceneSchema = z.object({
  art,
  color: hexColor,
  videoUrl: z.string().url().max(500).nullable().default(null),
  /** Stand-in clip or picture, waiting for a custom Zo animation. Shown as a badge in the admin. */
  placeholder: z.boolean().optional(),
});

export const storyChoiceSchema = z.object({
  id: nodeIdSchema,
  label: localizedTextSchema,
  art,
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
  art,
});

export const quizQuestionSchema = z.object({
  id: nodeIdSchema,
  prompt: localizedTextSchema,
  art,
  options: z.array(quizOptionSchema).min(2).max(4),
  correctOptionId: nodeIdSchema,
  /** Why the answer is right, read by Zo after a wrong answer ("because elephants have long trunks"). */
  explanation: localizedTextSchema.optional(),
});
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const quizBodySchema = z.object({
  kind: z.literal('quiz'),
  questions: z.array(quizQuestionSchema).min(1).max(50),
});
export type QuizBody = z.infer<typeof quizBodySchema>;

export const songLineSchema = z.object({
  text: localizedTextSchema,
  art,
});

export const songBodySchema = z.object({
  kind: z.literal('song'),
  /** Optional recorded track. Without it, lyrics are read aloud with gentle narration. */
  audioUrl: z.string().max(500).nullable().default(null),
  lines: z.array(songLineSchema).min(1).max(100),
});
export type SongBody = z.infer<typeof songBodySchema>;

export const VIDEO_SOURCES = ['pexels', 'pixabay', 'nasa', 'wikimedia', 'blender', 'kidzo', 'upload'] as const;
export type VideoSource = (typeof VIDEO_SOURCES)[number];

/** Where a clip came from and how it may be used. Shown on the Credits screen. */
export const videoCreditSchema = z.object({
  source: z.enum(VIDEO_SOURCES),
  sourceUrl: z.string().max(1000).nullable(),
  originalId: z.string().max(200).nullable(),
  author: z.string().max(200).nullable(),
  license: z.string().max(120),
  attribution: z.string().max(500),
  downloadedAt: z.string().max(40).nullable(),
});
export type VideoCredit = z.infer<typeof videoCreditSchema>;

const mediaUrl = z.string().max(1000);

/** A single video, optionally followed by a short quiz. */
export const videoBodySchema = z.object({
  kind: z.literal('video'),
  /** Default stream. */
  videoUrl: mediaUrl,
  /** Smaller and larger variants for data saver and Wi-Fi. */
  variants: z.object({ p480: mediaUrl.nullable(), p720: mediaUrl.nullable() }).default({ p480: null, p720: null }),
  thumbnailUrl: mediaUrl.nullable().default(null),
  durationSeconds: z.number().int().min(1).max(4 * 60 * 60),
  /** "none" when the source audio was removed because its music rights were unclear. */
  audio: z.enum(['original', 'narration', 'none']).default('original'),
  captions: localizedTextSchema.nullable().default(null),
  credit: videoCreditSchema,
  quiz: z.array(quizQuestionSchema).max(6).default([]),
});
export type VideoBody = z.infer<typeof videoBodySchema>;

export const contentBodySchema = z.discriminatedUnion('kind', [
  branchingBodySchema,
  quizBodySchema,
  songBodySchema,
  videoBodySchema,
]);
export type ContentBody = z.infer<typeof contentBodySchema>;

/** Which body kind each content type uses. */
export const BODY_KIND_FOR_TYPE: Record<ContentType, ContentBody['kind']> = {
  adventure: 'branching',
  story: 'branching',
  song: 'song',
  game: 'quiz',
  video: 'video',
};

const slugSchema = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words with hyphens, like ocean-pearl')
  .max(80);

const contentMetaShape = {
  slug: slugSchema,
  type: z.enum(CONTENT_TYPES),
  title: localizedTextSchema,
  summary: localizedTextSchema,
  ageMin: z.number().int().min(MIN_AGE).max(MAX_AGE),
  ageMax: z.number().int().min(MIN_AGE).max(MAX_AGE),
  /** Age groups that may receive this item. Filled from the age range when empty. */
  ageGroups: z.array(z.enum(AGE_GROUPS)).max(3).default([]),
  durationMinutes: z.number().int().min(1).max(120),
  skills: z.array(z.enum(SKILLS)).min(1).max(4),
  languages: z.array(localeSchema).min(1),
  coverArt: art,
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
  /** Picture for video tiles (from the video body). */
  thumbnailUrl: z.string().nullable().default(null),
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
  art,
  color: hexColor,
});
export type StickerInput = z.infer<typeof stickerInputSchema>;

export const stickerSchema = stickerInputSchema.extend({ id: z.uuid() });
export type Sticker = z.infer<typeof stickerSchema>;

export const childStickerSchema = stickerSchema.extend({ unlockedAt: z.string() });
export type ChildSticker = z.infer<typeof childStickerSchema>;

/** A "For you" pick for a child, with the skill that led to it (null for starter picks). */
export const recommendationSchema = z.object({
  item: contentSummarySchema,
  becauseSkill: z.enum(SKILLS).nullable(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;

/** One line on the Credits screen: a published video and where it came from. */
export const videoCreditEntrySchema = z.object({
  contentId: z.uuid(),
  title: localizedTextSchema,
  credit: videoCreditSchema,
});
export type VideoCreditEntry = z.infer<typeof videoCreditEntrySchema>;
