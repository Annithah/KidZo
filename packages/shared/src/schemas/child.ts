import { z } from 'zod';
import { CATEGORY_KEYS } from '../categories';
import { localeSchema, timeOfDaySchema } from './common';

export const AVATARS = ['fox', 'panda', 'owl', 'bunny', 'lion', 'turtle', 'whale', 'unicorn'] as const;
export type Avatar = (typeof AVATARS)[number];

/** Art key for an avatar portrait. */
export const avatarArt = (avatar: Avatar): string => `avatar.${avatar}`;

export const MIN_AGE = 2;
export const MAX_AGE = 12;

export const childSettingsSchema = z.object({
  /** null means no daily limit. */
  dailyLimitMinutes: z.number().int().min(10).max(240).nullable(),
  bedtimeEnabled: z.boolean(),
  bedtimeStart: timeOfDaySchema,
  bedtimeEnd: timeOfDaySchema,
  narrationEnabled: z.boolean(),
  soundEffectsVolume: z.number().min(0).max(1),
  /** Minutes before the limit when the child gets a gentle heads-up. */
  warningMinutes: z.number().int().min(1).max(15),
  /** ISO timestamp until which the app is locked by a parent, or null. */
  lockedUntil: z.string().nullable(),
  /** Content categories a parent has turned off for this child. Missing on older rows. */
  blockedCategories: z.array(z.enum(CATEGORY_KEYS)).max(CATEGORY_KEYS.length).default([]),
  /** How long the right/wrong feedback stays on screen after an answer. Missing on older rows. */
  feedbackSeconds: z.union([z.literal(3), z.literal(5), z.literal(8)]).default(5),
});
export type ChildSettings = z.infer<typeof childSettingsSchema>;

export const DEFAULT_CHILD_SETTINGS: ChildSettings = {
  dailyLimitMinutes: 60,
  bedtimeEnabled: true,
  bedtimeStart: '19:30',
  bedtimeEnd: '07:00',
  narrationEnabled: true,
  soundEffectsVolume: 0.6,
  warningMinutes: 5,
  lockedUntil: null,
  blockedCategories: [],
  feedbackSeconds: 5,
};

/** Fills settings fields added after a child was created (stored settings are JSON). */
export function normalizeChildSettings(settings: Partial<ChildSettings> & Omit<ChildSettings, 'blockedCategories' | 'feedbackSeconds'>): ChildSettings {
  return {
    ...DEFAULT_CHILD_SETTINGS,
    ...settings,
    blockedCategories: settings.blockedCategories ?? [],
    feedbackSeconds: settings.feedbackSeconds ?? DEFAULT_CHILD_SETTINGS.feedbackSeconds,
  };
}

export const updateChildSettingsSchema = childSettingsSchema
  .omit({ lockedUntil: true })
  .partial()
  // No default here: a partial update must not reset the blocked list.
  .extend({
    blockedCategories: z.array(z.enum(CATEGORY_KEYS)).max(CATEGORY_KEYS.length).optional(),
    feedbackSeconds: z.union([z.literal(3), z.literal(5), z.literal(8)]).optional(),
  });
export type UpdateChildSettingsInput = z.infer<typeof updateChildSettingsSchema>;

export const createChildSchema = z.object({
  name: z.string().trim().min(1).max(30),
  age: z.number().int().min(MIN_AGE).max(MAX_AGE),
  avatar: z.enum(AVATARS),
  locale: localeSchema.default('en'),
});
export type CreateChildInput = z.input<typeof createChildSchema>;

export const updateChildSchema = createChildSchema.partial();
export type UpdateChildInput = z.infer<typeof updateChildSchema>;

export const childSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  age: z.number().int(),
  avatar: z.enum(AVATARS),
  locale: localeSchema,
  stars: z.number().int(),
  settings: childSettingsSchema,
  createdAt: z.string(),
});
export type Child = z.infer<typeof childSchema>;

export const lockChildSchema = z.object({
  /** Lock duration in minutes. Omit to lock until the next bedtime end (morning). */
  minutes: z.number().int().min(1).max(24 * 60).optional(),
});

/** Friendly title shown under a child's name, by age. */
export function explorerTitle(age: number): string {
  if (age <= 3) return 'Tiny Explorer';
  if (age <= 5) return 'Little Explorer';
  if (age <= 8) return 'Brave Explorer';
  return 'Star Explorer';
}
