import { z } from 'zod';

const DEV_JWT_SECRET = 'dev-only-insecure-secret-change-me-0123456789';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  /** Postgres connection string. When unset, an embedded PGlite database is used (dev and tests only). */
  DATABASE_URL: z.string().url().optional(),
  PGLITE_DIR: z.string().default('./.data/pglite'),
  JWT_SECRET: z.string().min(32).default(DEV_JWT_SECRET),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(30),
  /** Comma separated list of allowed browser origins (admin dashboard, Expo web). */
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://localhost:8081'),
  UPLOAD_DIR: z.string().default('./uploads'),
  /** Public base URL used to build media links, e.g. https://api.kidzo.app */
  PUBLIC_BASE_URL: z.string().url().default('http://localhost:4000'),
  /** Link opened from the reset email. The app handles kidzo://reset-password?token=... */
  PASSWORD_RESET_URL: z.string().default('kidzo://reset-password'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(10).optional(),
});

export type Config = z.infer<typeof envSchema> & { corsOrigins: string[] };

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${issues}`);
  }
  const config = parsed.data;
  if (config.NODE_ENV === 'production') {
    if (config.JWT_SECRET === DEV_JWT_SECRET) throw new Error('JWT_SECRET must be set in production');
    if (!config.DATABASE_URL) throw new Error('DATABASE_URL must be set in production');
  }
  return {
    ...config,
    corsOrigins: config.CORS_ORIGINS.split(',')
      .map((o) => o.trim())
      .filter(Boolean),
  };
}
