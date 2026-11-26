import { z } from 'zod';
import { SKILLS } from './content';

export const adminStatsSchema = z.object({
  parents: z.number().int(),
  children: z.number().int(),
  content: z.object({
    published: z.number().int(),
    draft: z.number().int(),
    review: z.number().int(),
    unpublished: z.number().int(),
    archived: z.number().int(),
  }),
  sessionsLast7Days: z.number().int(),
  completionsLast7Days: z.number().int(),
  completionRatePercent: z.number().min(0).max(100),
  averagePlaySeconds: z.number().int().min(0),
  averageCompletionSeconds: z.number().int().min(0),
  topContent: z.array(z.object({ id: z.uuid(), title: z.string(), plays: z.number().int() })),
  topSkills: z.array(z.object({ skill: z.enum(SKILLS), plays: z.number().int() })),
  topGames: z.array(z.object({ id: z.uuid(), title: z.string(), plays: z.number().int() })),
  lowEngagementContent: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      plays: z.number().int(),
      completionRatePercent: z.number().min(0).max(100),
    }),
  ),
  dailyActivity: z.array(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      newFamilies: z.number().int(),
      newChildren: z.number().int(),
      plays: z.number().int(),
      completions: z.number().int(),
    }),
  ),
});
export type AdminStats = z.infer<typeof adminStatsSchema>;

export const adminUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(['parent', 'admin']),
  childCount: z.number().int(),
  createdAt: z.string(),
});
export type AdminUser = z.infer<typeof adminUserSchema>;

export const auditEntrySchema = z.object({
  id: z.uuid(),
  actorEmail: z.string().nullable(),
  action: z.string(),
  entity: z.string(),
  entityId: z.string().nullable(),
  createdAt: z.string(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const mediaUploadResultSchema = z.object({
  url: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
});
export type MediaUploadResult = z.infer<typeof mediaUploadResultSchema>;

export const ALLOWED_MEDIA_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'video/mp4',
] as const;
export const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
export const MAX_UPLOAD_BYTES = MAX_VIDEO_BYTES;

/** Popular choices and endings per branching story, from completed sessions in a date range. */
export const storyChoiceInsightsSchema = z.object({
  days: z.number().int(),
  stories: z.array(
    z.object({
      id: z.uuid(),
      title: z.string(),
      paths: z.number().int(),
      endings: z.array(z.object({ nodeId: z.string(), text: z.string(), count: z.number().int(), percent: z.number() })),
      choices: z.array(
        z.object({
          nodeId: z.string(),
          text: z.string(),
          reached: z.number().int(),
          picks: z.array(z.object({ choiceId: z.string(), label: z.string(), count: z.number().int(), percent: z.number() })),
        }),
      ),
    }),
  ),
});
export type StoryChoiceInsights = z.infer<typeof storyChoiceInsightsSchema>;
