import { z } from 'zod';
import { MAX_AGE, MIN_AGE } from './child';
import { CONTENT_TYPES, SKILLS } from './content';

export const guestCatalogQuerySchema = z.object({
  age: z.coerce.number().int().min(MIN_AGE).max(MAX_AGE),
  type: z.enum(CONTENT_TYPES).optional(),
  skill: z.enum(SKILLS).optional(),
});

export const guestPlaybackSchema = z.object({
  contentId: z.uuid(),
  secondsPlayed: z.number().int().min(0).max(2 * 60 * 60),
  completed: z.boolean(),
  path: z.array(z.string().min(1).max(40)).max(200).default([]),
  answers: z.record(z.string().min(1).max(40), z.string().min(1).max(40)).optional(),
});
export type GuestPlaybackInput = z.infer<typeof guestPlaybackSchema>;
