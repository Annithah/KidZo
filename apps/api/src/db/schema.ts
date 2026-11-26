import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import type {
  AgeGroup,
  ChildSettings,
  ContentBody,
  ContentStatus,
  ContentType,
  Locale,
  LocalizedText,
  Role,
  Skill,
} from '@kidzo/shared';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  displayName: text('display_name').notNull(),
  role: text('role').$type<Role>().notNull().default('parent'),
  locale: text('locale').$type<Locale>().notNull().default('en'),
  timezone: text('timezone').notNull().default('UTC'),
  pinHash: text('pin_hash'),
  pinFailedAttempts: integer('pin_failed_attempts').notNull().default(0),
  pinLockedUntil: timestamp('pin_locked_until', { withTimezone: true }),
  consentAt: timestamp('consent_at', { withTimezone: true }).notNull(),
  ...timestamps,
});

export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('refresh_tokens_user_idx').on(t.userId)],
);

export const children = pgTable(
  'children',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    parentId: uuid('parent_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    age: integer('age').notNull(),
    avatar: text('avatar').notNull(),
    locale: text('locale').$type<Locale>().notNull().default('en'),
    stars: integer('stars').notNull().default(0),
    settings: jsonb('settings').$type<ChildSettings>().notNull(),
    ...timestamps,
  },
  (t) => [index('children_parent_idx').on(t.parentId)],
);

export const stickers = pgTable('stickers', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: text('slug').notNull().unique(),
  name: jsonb('name').$type<LocalizedText>().notNull(),
  art: text('art').notNull(),
  color: text('color').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const content = pgTable(
  'content',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    type: text('type').$type<ContentType>().notNull(),
    status: text('status').$type<ContentStatus>().notNull().default('draft'),
    title: jsonb('title').$type<LocalizedText>().notNull(),
    summary: jsonb('summary').$type<LocalizedText>().notNull(),
    ageMin: integer('age_min').notNull(),
    ageMax: integer('age_max').notNull(),
    /** Age groups allowed to receive this item; always filled (from the range when not chosen). */
    ageGroups: jsonb('age_groups').$type<AgeGroup[]>().notNull().default([]),
    /** Main video length for video content, used to enforce each age group's limit. */
    videoSeconds: integer('video_seconds'),
    /** "source:originalId" for imported or generated items, so pipelines never create duplicates. */
    sourceKey: text('source_key').unique(),
    durationMinutes: integer('duration_minutes').notNull(),
    skills: jsonb('skills').$type<Skill[]>().notNull(),
    languages: jsonb('languages').$type<Locale[]>().notNull(),
    coverArt: text('cover_art').notNull(),
    coverColor: text('cover_color').notNull(),
    calm: boolean('calm').notNull().default(false),
    featured: boolean('featured').notNull().default(false),
    rewardStars: integer('reward_stars').notNull().default(0),
    rewardStickerId: uuid('reward_sticker_id').references(() => stickers.id, { onDelete: 'set null' }),
    body: jsonb('body').$type<ContentBody>().notNull(),
    version: integer('version').notNull().default(1),
    sizeBytes: integer('size_bytes').notNull().default(0),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('content_status_idx').on(t.status)],
);

/** Stored media files for a content item (variants, thumbnail) with their origin and license. */
export const mediaAssets = pgTable(
  'media_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    contentId: uuid('content_id').references(() => content.id, { onDelete: 'cascade' }),
    /** source, p480, p720, thumbnail, narration */
    role: text('role').notNull(),
    storageKey: text('storage_key').notNull(),
    url: text('url').notNull(),
    contentType: text('content_type').notNull(),
    sizeBytes: integer('size_bytes').notNull().default(0),
    width: integer('width'),
    height: integer('height'),
    durationSeconds: integer('duration_seconds'),
    source: text('source').notNull(),
    sourceUrl: text('source_url'),
    originalId: text('original_id'),
    author: text('author'),
    license: text('license').notNull(),
    attribution: text('attribution').notNull(),
    downloadedAt: timestamp('downloaded_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('media_assets_content_idx').on(t.contentId)],
);

export const childStickers = pgTable(
  'child_stickers',
  {
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    stickerId: uuid('sticker_id')
      .notNull()
      .references(() => stickers.id, { onDelete: 'cascade' }),
    unlockedAt: timestamp('unlocked_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.childId, t.stickerId] })],
);

export const playSessions = pgTable(
  'play_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientSessionId: uuid('client_session_id').notNull().unique(),
    childId: uuid('child_id')
      .notNull()
      .references(() => children.id, { onDelete: 'cascade' }),
    contentId: uuid('content_id')
      .notNull()
      .references(() => content.id, { onDelete: 'cascade' }),
    familyMode: boolean('family_mode').notNull().default(false),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    lastActiveAt: timestamp('last_active_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    /** Child's local calendar date (YYYY-MM-DD) when the session started, used for daily limits. */
    localDate: text('local_date').notNull(),
    secondsPlayed: integer('seconds_played').notNull().default(0),
    completed: boolean('completed').notNull().default(false),
    starsEarned: integer('stars_earned').notNull().default(0),
    path: jsonb('path').$type<string[]>().notNull().default([]),
  },
  (t) => [index('play_sessions_child_date_idx').on(t.childId, t.localDate)],
);

export const guestContentDailyStats = pgTable(
  'guest_content_daily_stats',
  {
    contentId: uuid('content_id')
      .notNull()
      .references(() => content.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    plays: integer('plays').notNull().default(0),
    completions: integer('completions').notNull().default(0),
    secondsPlayed: integer('seconds_played').notNull().default(0),
    completedSeconds: integer('completed_seconds').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.contentId, t.date] }), index('guest_content_daily_date_idx').on(t.date)],
);

export const media = pgTable('media', {
  id: uuid('id').primaryKey().defaultRandom(),
  storageKey: text('storage_key').notNull().unique(),
  contentType: text('content_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('audit_logs_created_idx').on(t.createdAt)],
);

export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('password_reset_user_idx').on(t.userId)],
);
