import { z } from 'zod';
import { stickerSchema } from './content';

export const BLOCK_REASONS = ['locked', 'bedtime', 'limit', 'age', 'category'] as const;
export type BlockReason = (typeof BLOCK_REASONS)[number];

export const startSessionSchema = z.object({
  childId: z.uuid(),
  contentId: z.uuid(),
  familyMode: z.boolean().default(false),
  /** Client generated id so offline sessions can be synced idempotently. */
  clientSessionId: z.uuid(),
});
export type StartSessionInput = z.input<typeof startSessionSchema>;

export const heartbeatSchema = z.object({
  /** Seconds played since the previous heartbeat. Capped server side. */
  seconds: z.number().int().min(0).max(300),
});

const pathSchema = z.array(z.string().max(40)).max(400);
const answersSchema = z.record(z.string().max(40), z.string().max(40));

export const completeSessionSchema = z.object({
  seconds: z.number().int().min(0).max(300),
  /** Node ids visited for branching content, or question ids answered for quizzes. */
  path: pathSchema,
  /** Quiz answers keyed by question id. */
  answers: answersSchema.optional(),
});
export type CompleteSessionInput = z.infer<typeof completeSessionSchema>;

export const sessionSchema = z.object({
  id: z.uuid(),
  childId: z.uuid(),
  contentId: z.uuid(),
  familyMode: z.boolean(),
  startedAt: z.string(),
  endedAt: z.string().nullable(),
  secondsPlayed: z.number().int(),
  completed: z.boolean(),
  starsEarned: z.number().int(),
});
export type PlaySession = z.infer<typeof sessionSchema>;

export const completionResultSchema = z.object({
  session: sessionSchema,
  starsEarned: z.number().int(),
  totalStars: z.number().int(),
  stickerUnlocked: stickerSchema.nullable(),
});
export type CompletionResult = z.infer<typeof completionResultSchema>;

export const offlineSessionSchema = z.object({
  clientSessionId: z.uuid(),
  childId: z.uuid(),
  contentId: z.uuid(),
  familyMode: z.boolean(),
  startedAt: z.iso.datetime(),
  seconds: z.number().int().min(0).max(4 * 60 * 60),
  completed: z.boolean(),
  path: pathSchema,
  answers: answersSchema.optional(),
});
export type OfflineSession = z.infer<typeof offlineSessionSchema>;

export const syncSessionsSchema = z.object({
  sessions: z.array(offlineSessionSchema).min(1).max(100),
});

export const syncResultSchema = z.object({
  accepted: z.number().int(),
  duplicates: z.number().int(),
  rejected: z.array(z.object({ clientSessionId: z.string(), reason: z.string() })),
});
export type SyncResult = z.infer<typeof syncResultSchema>;

export const todayStatusSchema = z.object({
  date: z.string(),
  secondsPlayed: z.number().int(),
  dailyLimitMinutes: z.number().int().nullable(),
  remainingSeconds: z.number().int().nullable(),
  bedtimeActive: z.boolean(),
  locked: z.boolean(),
  lockedUntil: z.string().nullable(),
  adventuresCompleted: z.number().int(),
  starsEarnedToday: z.number().int(),
});
export type TodayStatus = z.infer<typeof todayStatusSchema>;

export const insightsSchema = z.object({
  rangeStart: z.string(),
  rangeEnd: z.string(),
  totalSeconds: z.number().int(),
  sessionsCompleted: z.number().int(),
  starsEarned: z.number().int(),
  dailyMinutes: z.array(z.object({ date: z.string(), minutes: z.number() })),
  topSkills: z.array(z.object({ skill: z.string(), count: z.number().int() })),
  highlight: z.object({ skill: z.string(), count: z.number().int() }).nullable(),
});
export type Insights = z.infer<typeof insightsSchema>;
