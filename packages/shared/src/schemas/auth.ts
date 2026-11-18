import { z } from 'zod';
import { localeSchema, timezoneSchema } from './common';

export const ROLES = ['parent', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters')
  .max(128)
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), 'Use letters and numbers');

export const emailSchema = z.email().trim().toLowerCase().max(254);

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().min(1).max(60),
  locale: localeSchema.default('en'),
  timezone: timezoneSchema.default('UTC'),
  /** Parent confirms they are an adult and the parent or guardian, and accepts the privacy policy. */
  parentalConsent: z.literal(true, { error: 'Parental consent is required' }),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(20).max(512),
});

export const pinSchema = z.string().regex(/^\d{4}$/, 'PIN must be 4 digits');
export const setPinSchema = z.object({
  pin: pinSchema,
  /** Required when a PIN already exists. */
  currentPassword: z.string().min(1).max(128).optional(),
});
export const verifyPinSchema = z.object({ pin: pinSchema });

export const userSchema = z.object({
  id: z.uuid(),
  email: z.string(),
  displayName: z.string(),
  role: z.enum(ROLES),
  locale: localeSchema,
  timezone: z.string(),
  hasPin: z.boolean(),
  createdAt: z.string(),
});
export type User = z.infer<typeof userSchema>;

export const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60),
    locale: localeSchema,
    timezone: timezoneSchema,
  })
  .partial();
export type UpdateMeInput = z.infer<typeof updateMeSchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;

export const authResponseSchema = z.object({
  user: userSchema,
  tokens: authTokensSchema,
});
export type AuthResponse = z.infer<typeof authResponseSchema>;

export const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });
export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});
