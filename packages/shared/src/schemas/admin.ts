import { z } from 'zod';

export const adminStatsSchema = z.object({
  parents: z.number().int(),
  children: z.number().int(),
  content: z.object({
    published: z.number().int(),
    draft: z.number().int(),
    archived: z.number().int(),
  }),
  sessionsLast7Days: z.number().int(),
  completionsLast7Days: z.number().int(),
  topContent: z.array(z.object({ id: z.uuid(), title: z.string(), plays: z.number().int() })),
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
] as const;
export const MAX_MEDIA_BYTES = 15 * 1024 * 1024;
