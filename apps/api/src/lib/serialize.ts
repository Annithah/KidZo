import type {
  Child,
  ContentDetail,
  ContentSummary,
  PlaySession,
  Sticker,
  User,
} from '@kidzo/shared';
import { ageGroupsForRange, normalizeChildSettings } from '@kidzo/shared';
import type { children, content, playSessions, stickers, users } from '../db/schema';

type UserRow = typeof users.$inferSelect;
type ChildRow = typeof children.$inferSelect;
type ContentRow = typeof content.$inferSelect;
type StickerRow = typeof stickers.$inferSelect;
type SessionRow = typeof playSessions.$inferSelect;

export const toUser = (u: UserRow): User => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  role: u.role,
  locale: u.locale,
  timezone: u.timezone,
  hasPin: u.pinHash !== null,
  createdAt: u.createdAt.toISOString(),
});

export const toChild = (c: ChildRow): Child => ({
  id: c.id,
  name: c.name,
  age: c.age,
  avatar: c.avatar as Child['avatar'],
  locale: c.locale,
  stars: c.stars,
  settings: normalizeChildSettings(c.settings),
  createdAt: c.createdAt.toISOString(),
});

export const toContentSummary = (c: ContentRow): ContentSummary => ({
  id: c.id,
  slug: c.slug,
  type: c.type,
  status: c.status,
  title: c.title,
  summary: c.summary,
  ageMin: c.ageMin,
  ageMax: c.ageMax,
  ageGroups: c.ageGroups.length ? c.ageGroups : ageGroupsForRange(c.ageMin, c.ageMax),
  durationMinutes: c.durationMinutes,
  skills: c.skills,
  languages: c.languages,
  coverArt: c.coverArt,
  coverColor: c.coverColor,
  calm: c.calm,
  featured: c.featured,
  rewardStars: c.rewardStars,
  rewardStickerId: c.rewardStickerId,
  version: c.version,
  sizeBytes: c.sizeBytes,
  updatedAt: c.updatedAt.toISOString(),
  publishedAt: c.publishedAt ? c.publishedAt.toISOString() : null,
  thumbnailUrl: c.body.kind === 'video' ? c.body.thumbnailUrl : null,
});

export const toContentDetail = (c: ContentRow): ContentDetail => ({
  ...toContentSummary(c),
  body: c.body,
});

export const toSticker = (s: StickerRow): Sticker => ({
  id: s.id,
  slug: s.slug,
  name: s.name,
  art: s.art,
  color: s.color,
});

export const toSession = (s: SessionRow): PlaySession => ({
  id: s.id,
  childId: s.childId,
  contentId: s.contentId,
  familyMode: s.familyMode,
  startedAt: s.startedAt.toISOString(),
  endedAt: s.endedAt ? s.endedAt.toISOString() : null,
  secondsPlayed: s.secondsPlayed,
  completed: s.completed,
  starsEarned: s.starsEarned,
});
