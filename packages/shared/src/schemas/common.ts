import { z } from 'zod';

export const LOCALES = ['en', 'fr', 'rw', 'sw'] as const;
export type Locale = (typeof LOCALES)[number];
export const localeSchema = z.enum(LOCALES);

export const LOCALE_LABELS: Record<Locale, { short: string; native: string }> = {
  en: { short: 'EN', native: 'English' },
  rw: { short: 'RW', native: 'Kinyarwanda' },
  fr: { short: 'FR', native: 'Français' },
  sw: { short: 'SW', native: 'Kiswahili' },
};

export const idSchema = z.uuid();

/** Text with an English base and optional translations. */
export const localizedTextSchema = z.object({
  en: z.string().trim().min(1).max(2000),
  fr: z.string().trim().max(2000).optional(),
  rw: z.string().trim().max(2000).optional(),
  sw: z.string().trim().max(2000).optional(),
});
export type LocalizedText = z.infer<typeof localizedTextSchema>;

export function localize(text: LocalizedText, locale: Locale): string {
  const value = text[locale];
  return value && value.length > 0 ? value : text.en;
}

/** "HH:mm" 24 hour clock. */
export const timeOfDaySchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');

export const timezoneSchema = z.string().min(1).max(64).refine((tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}, 'Unknown time zone');

export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
});
export type ApiErrorBody = z.infer<typeof apiErrorSchema>;

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});
