/**
 * On-device KIDZO backend. Answers the same HTTP routes as apps/api, but from a JSON database
 * kept on the phone, so a standalone build works with no server running. Pure TypeScript
 * (no React Native imports) so it can be unit tested. Used when EXPO_PUBLIC_LOCAL_BACKEND=1.
 */
import type { z } from 'zod';
import {
  CHILD_TOKEN_HEADER,
  DEFAULT_CHILD_SETTINGS,
  completeSessionSchema,
  computeStars,
  contentInputSchema,
  createChildSchema,
  deleteAccountSchema,
  estimatePackageBytes,
  evaluatePlayPolicy,
  forgotPasswordSchema,
  heartbeatSchema,
  isAgeAppropriate,
  ageGroupFor,
  ageGroupsForRange,
  isAllowedForChild,
  isForAgeGroup,
  normalizeChildSettings,
  recommendContent,
  isLocked,
  localParts,
  lockChildSchema,
  loginSchema,
  nextOccurrence,
  refreshSchema,
  registerSchema,
  setPinSchema,
  startSessionSchema,
  stickerInputSchema,
  syncSessionsSchema,
  updateChildSchema,
  updateChildSettingsSchema,
  updateMeSchema,
  verifyPinSchema,
  type Child,
  type ChildSettings,
  type CompletionResult,
  type ContentDetail,
  type ContentSummary,
  type Insights,
  type Locale,
  type PlaySession,
  type Role,
  type Sticker,
  type SyncResult,
  type TodayStatus,
  type User,
} from '@kidzo/shared';
import { readJson, writeJson, type KeyValueStore } from '../kv';
import { ART, hasLegacyFields, upgradeLegacyContent, upgradeLegacySticker } from '@kidzo/art';
import { seedContent, seedStickers } from './seed-data';

export const LOCAL_BASE_URL = 'local://kidzo';
const DB_KEY = 'kidzo.local-backend.v1';
const MAX_CHILDREN = 8;
const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 5;
const HEARTBEAT_SLACK_SECONDS = 10;
const ACCESS_TOKEN_SECONDS = 365 * 24 * 3600;

export const DEMO_PARENT = { email: 'parent@kidzo.local', password: 'KidzoParent2026', pin: '1234' };

const BLOCK_MESSAGES = {
  locked: 'A grown-up has paused play for now.',
  bedtime: "It's calm time. Games are resting until morning.",
  limit: "That's all the play time for today. See you tomorrow!",
  age: 'This one is for older explorers.',
  category: 'A grown-up has turned this kind of play off.',
} as const;

interface DbUser {
  id: string;
  email: string;
  salt: string;
  passwordHash: string;
  pinHash: string | null;
  pinFailedAttempts: number;
  pinLockedUntil: string | null;
  displayName: string;
  role: Role;
  locale: Locale;
  timezone: string;
  createdAt: string;
}

interface DbChild extends Child {
  parentId: string;
}

interface DbSession extends PlaySession {
  clientSessionId: string;
  lastActiveAt: string;
  localDate: string;
  path: string[];
}

interface Db {
  version: 1;
  users: DbUser[];
  children: DbChild[];
  sessions: DbSession[];
  childStickers: { childId: string; stickerId: string; unlockedAt: string }[];
  stickers: Sticker[];
  content: ContentDetail[];
  accessTokens: Record<string, string>;
  refreshTokens: Record<string, string>;
  /** Child-scoped tokens: token -> parent, child and expiry. Missing in databases saved before. */
  childTokens?: Record<string, { userId: string; childId: string; expiresAt: string }>;
}

/** On-device databases saved before the art library stored emoji; convert them to art keys. */
function upgradeStoredDb(db: Db): Db {
  if (!hasLegacyFields(db.stickers) && !hasLegacyFields(db.content)) return db;
  const keys = new Set(ART.keys());
  return {
    ...db,
    stickers: db.stickers.map((s) => upgradeLegacySticker(s, keys)),
    content: db.content.map((c) => upgradeLegacyContent(c)),
  };
}

export interface LocalBackendDeps {
  store: KeyValueStore;
  randomId: () => string;
  /** Returns a hex digest of the input. SHA-256 on device. */
  digest: (input: string) => Promise<string>;
  now?: () => Date;
}

class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

const badRequest = (m: string, d?: unknown) => new HttpError(400, 'BAD_REQUEST', m, d);
const unauthorized = (m = 'Please sign in again') => new HttpError(401, 'UNAUTHORIZED', m);
const notFound = (what: string) => new HttpError(404, 'NOT_FOUND', `${what} not found`);

function parse<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new HttpError(
      400,
      'VALIDATION_ERROR',
      'Some fields need attention',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}

const json = (status: number, body?: unknown): Response =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
  });

const toUser = (u: DbUser): User => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  role: u.role,
  locale: u.locale,
  timezone: u.timezone,
  hasPin: u.pinHash !== null,
  createdAt: u.createdAt,
});

const toChild = ({ parentId: _parentId, ...c }: DbChild): Child => ({ ...c, settings: normalizeChildSettings(c.settings) });

const toSession = (s: DbSession): PlaySession => ({
  id: s.id,
  childId: s.childId,
  contentId: s.contentId,
  familyMode: s.familyMode,
  startedAt: s.startedAt,
  endedAt: s.endedAt,
  secondsPlayed: s.secondsPlayed,
  completed: s.completed,
  starsEarned: s.starsEarned,
});

/** Content saved before age groups existed gets them from its age range. */
const withGroups = <T extends ContentSummary>(c: T): T => ({ ...c, ageGroups: c.ageGroups?.length ? c.ageGroups : ageGroupsForRange(c.ageMin, c.ageMax) });
const toSummary = ({ body, ...c }: ContentDetail): ContentSummary => withGroups({ ...c, thumbnailUrl: body.kind === 'video' ? body.thumbnailUrl : null });
const videoSecondsOf = (c: ContentDetail) => (c.body.kind === 'video' ? c.body.durationSeconds : null);

function parseQuery(search: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of search.split('&')) {
    if (!part) continue;
    const [k, v = ''] = part.split('=');
    if (k) out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
  }
  return out;
}

export function createLocalBackend(deps: LocalBackendDeps) {
  const now = deps.now ?? (() => new Date());
  let dbPromise: Promise<Db> | null = null;
  let queue: Promise<unknown> = Promise.resolve();

  const hashSecret = async (salt: string, secret: string) => deps.digest(`kidzo:${salt}:${secret}`);
  const newToken = () => `${deps.randomId()}${deps.randomId()}`.replace(/-/g, '');

  async function seed(): Promise<Db> {
    const ts = now().toISOString();
    const stickers: Sticker[] = seedStickers.map((raw) => ({ ...stickerInputSchema.parse(raw), id: deps.randomId() }));
    const bySlug = new Map(stickers.map((s) => [s.slug, s.id]));
    const content: ContentDetail[] = seedContent.map(({ rewardSticker, ...raw }) => {
      const input = contentInputSchema.parse({
        ...raw,
        rewardStickerId: rewardSticker ? (bySlug.get(rewardSticker) ?? null) : null,
      });
      return {
        ...input,
        id: deps.randomId(),
        status: 'published',
        thumbnailUrl: null,
        version: 1,
        sizeBytes: estimatePackageBytes(input.body),
        updatedAt: ts,
        publishedAt: ts,
      };
    });
    const salt = deps.randomId();
    const parent: DbUser = {
      id: deps.randomId(),
      email: DEMO_PARENT.email,
      salt,
      passwordHash: await hashSecret(salt, DEMO_PARENT.password),
      pinHash: await hashSecret(salt, `pin:${DEMO_PARENT.pin}`),
      pinFailedAttempts: 0,
      pinLockedUntil: null,
      displayName: 'Amara',
      role: 'parent',
      locale: 'en',
      timezone: 'Africa/Kigali',
      createdAt: ts,
    };
    const kid = (name: string, age: number, avatar: Child['avatar'], settings: ChildSettings): DbChild => ({
      id: deps.randomId(),
      parentId: parent.id,
      name,
      age,
      avatar,
      locale: 'en',
      stars: 0,
      settings,
      createdAt: ts,
    });
    return {
      version: 1,
      users: [parent],
      children: [
        kid('Mia', 5, 'fox', DEFAULT_CHILD_SETTINGS),
        kid('Kayla', 8, 'owl', { ...DEFAULT_CHILD_SETTINGS, dailyLimitMinutes: 90 }),
      ],
      sessions: [],
      childStickers: [],
      stickers,
      content,
      accessTokens: {},
      refreshTokens: {},
    };
  }

  async function load(): Promise<Db> {
    dbPromise ??= (async () => {
      const existing = await readJson<Db | null>(deps.store, DB_KEY, null);
      if (existing && existing.version === 1) return upgradeStoredDb(existing);
      const fresh = await seed();
      await writeJson(deps.store, DB_KEY, fresh);
      return fresh;
    })();
    return dbPromise;
  }

  const save = (db: Db) => writeJson(deps.store, DB_KEY, db);

  async function issueTokens(db: Db, userId: string) {
    const accessToken = newToken();
    const refreshToken = newToken();
    db.accessTokens[accessToken] = userId;
    db.refreshTokens[refreshToken] = userId;
    return { accessToken, refreshToken, expiresIn: ACCESS_TOKEN_SECONDS };
  }

  function revokeAll(db: Db, userId: string) {
    for (const map of [db.accessTokens, db.refreshTokens]) {
      for (const [token, owner] of Object.entries(map)) if (owner === userId) delete map[token];
    }
  }

  function ownedChild(db: Db, user: DbUser, childId: string): DbChild {
    const child = db.children.find((c) => c.id === childId);
    if (!child) throw notFound('Child');
    if (child.parentId !== user.id) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this');
    // Children saved by an older app version lack newer settings fields.
    child.settings = normalizeChildSettings(child.settings);
    return child;
  }

  const secondsOn = (db: Db, childId: string, date: string) =>
    db.sessions.filter((s) => s.childId === childId && s.localDate === date).reduce((n, s) => n + s.secondsPlayed, 0);

  function cappedSeconds(session: DbSession, reported: number, at: Date): number {
    const elapsed = Math.floor((at.getTime() - new Date(session.lastActiveAt).getTime()) / 1000) + HEARTBEAT_SLACK_SECONDS;
    return Math.max(0, Math.min(reported, elapsed));
  }

  function award(
    db: Db,
    session: DbSession,
    child: DbChild,
    item: ContentDetail,
    stars: number,
    extraSeconds: number,
    path: string[],
    at: Date,
  ): CompletionResult {
    session.completed = true;
    session.endedAt = at.toISOString();
    session.lastActiveAt = at.toISOString();
    session.starsEarned = stars;
    session.path = path;
    session.secondsPlayed += extraSeconds;
    child.stars += stars;
    let stickerUnlocked: Sticker | null = null;
    const stickerId = item.rewardStickerId;
    if (stickerId && !db.childStickers.some((s) => s.childId === child.id && s.stickerId === stickerId)) {
      db.childStickers.push({ childId: child.id, stickerId, unlockedAt: at.toISOString() });
      stickerUnlocked = db.stickers.find((s) => s.id === stickerId) ?? null;
    }
    return { session: toSession(session), starsEarned: stars, totalStars: child.stars, stickerUnlocked };
  }

  function todayStatus(db: Db, child: DbChild, tz: string): TodayStatus {
    const at = now();
    const { date } = localParts(at, tz);
    const rows = db.sessions.filter((s) => s.childId === child.id && s.localDate === date);
    const secondsPlayed = rows.reduce((n, s) => n + s.secondsPlayed, 0);
    const policy = evaluatePlayPolicy({ settings: child.settings, secondsPlayedToday: secondsPlayed, now: at, timeZone: tz, childAge: child.age });
    return {
      date,
      secondsPlayed,
      dailyLimitMinutes: child.settings.dailyLimitMinutes,
      remainingSeconds: policy.remainingSeconds,
      bedtimeActive: policy.bedtimeActive,
      locked: isLocked(child.settings, at),
      lockedUntil: child.settings.lockedUntil,
      adventuresCompleted: rows.filter((s) => s.completed).length,
      starsEarnedToday: rows.reduce((n, s) => n + s.starsEarned, 0),
    };
  }

  function insights(db: Db, child: DbChild, tz: string): Insights {
    const at = now();
    const dates: string[] = [];
    for (let i = 6; i >= 0; i -= 1) dates.push(localParts(new Date(at.getTime() - i * 86_400_000), tz).date);
    const unique = [...new Set(dates)];
    const perDay = new Map(unique.map((d) => [d, 0]));
    const skillCounts = new Map<string, number>();
    let totalSeconds = 0;
    let sessionsCompleted = 0;
    let starsEarned = 0;
    for (const s of db.sessions) {
      if (s.childId !== child.id || !perDay.has(s.localDate)) continue;
      const item = db.content.find((c) => c.id === s.contentId);
      perDay.set(s.localDate, (perDay.get(s.localDate) ?? 0) + s.secondsPlayed);
      totalSeconds += s.secondsPlayed;
      starsEarned += s.starsEarned;
      if (s.completed) {
        sessionsCompleted += 1;
        for (const skill of item?.skills ?? []) skillCounts.set(skill, (skillCounts.get(skill) ?? 0) + 1);
      }
    }
    const topSkills = [...skillCounts.entries()]
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count || a.skill.localeCompare(b.skill))
      .slice(0, 5);
    return {
      rangeStart: unique[0] ?? '',
      rangeEnd: unique[unique.length - 1] ?? '',
      totalSeconds,
      sessionsCompleted,
      starsEarned,
      dailyMinutes: unique.map((date) => ({ date, minutes: Math.round(((perDay.get(date) ?? 0) / 60) * 10) / 10 })),
      topSkills,
      highlight: topSkills[0] ?? null,
    };
  }

  async function route(db: Db, method: string, path: string, query: Record<string, string>, body: unknown, token: string | null, childToken: string | null): Promise<Response> {
    const at = now();
    const seg = path.split('/').filter(Boolean);

    // Public auth routes.
    if (method === 'POST' && path === '/auth/register') {
      const input = parse(registerSchema, body);
      if (db.users.some((u) => u.email === input.email)) throw new HttpError(409, 'CONFLICT', 'An account with this email already exists');
      const salt = deps.randomId();
      const user: DbUser = {
        id: deps.randomId(),
        email: input.email,
        salt,
        passwordHash: await hashSecret(salt, input.password),
        pinHash: null,
        pinFailedAttempts: 0,
        pinLockedUntil: null,
        displayName: input.displayName,
        role: 'parent',
        locale: input.locale,
        timezone: input.timezone,
        createdAt: at.toISOString(),
      };
      db.users.push(user);
      return json(201, { user: toUser(user), tokens: await issueTokens(db, user.id) });
    }
    if (method === 'POST' && path === '/auth/login') {
      const input = parse(loginSchema, body);
      const user = db.users.find((u) => u.email === input.email);
      if (!user || (await hashSecret(user.salt, input.password)) !== user.passwordHash) {
        throw unauthorized('Email or password is incorrect');
      }
      return json(200, { user: toUser(user), tokens: await issueTokens(db, user.id) });
    }
    if (method === 'POST' && path === '/auth/refresh') {
      const { refreshToken } = parse(refreshSchema, body);
      const userId = db.refreshTokens[refreshToken];
      const user = userId ? db.users.find((u) => u.id === userId) : undefined;
      if (!user) throw unauthorized();
      delete db.refreshTokens[refreshToken];
      return json(200, { user: toUser(user), tokens: await issueTokens(db, user.id) });
    }
    if (method === 'POST' && path === '/auth/logout') {
      const { refreshToken } = parse(refreshSchema, body);
      delete db.refreshTokens[refreshToken];
      return json(204);
    }
    if (method === 'POST' && path === '/auth/password/forgot') {
      parse(forgotPasswordSchema, body);
      return json(202, { ok: true });
    }
    if (method === 'POST' && path === '/auth/password/reset') {
      throw badRequest('Password reset needs the online KIDZO service. Sign in with your password instead.');
    }

    const userId = token ? db.accessTokens[token] : undefined;
    const user = userId ? db.users.find((u) => u.id === userId) : undefined;
    if (!user) throw unauthorized();

    // Kid requests name the child with a child-scoped token, like the real API.
    const childScope = (): DbChild | null => {
      if (!childToken) return null;
      const entry = db.childTokens?.[childToken];
      if (!entry || new Date(entry.expiresAt).getTime() <= at.getTime()) throw new HttpError(401, 'CHILD_TOKEN_INVALID', 'Open the child profile again');
      if (entry.userId !== user.id) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this');
      return ownedChild(db, user, entry.childId);
    };
    const requireChild = (childId?: string): DbChild => {
      const child = childScope();
      if (!child) throw new HttpError(401, 'CHILD_TOKEN_REQUIRED', 'Choose who is playing first');
      if (childId !== undefined && childId !== child.id) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this');
      return child;
    };
    const allowedFor = (child: DbChild) => (c: ContentDetail) =>
      isAgeAppropriate(child.age, c.ageMin, c.ageMax) &&
      isAllowedForChild({ age: child.age, blockedCategories: child.settings.blockedCategories }, ageGroupFor(child.age), { ...withGroups(c), videoSeconds: videoSecondsOf(c) });

    // Account.
    if (path === '/me' && method === 'GET') return json(200, toUser(user));
    if (path === '/me' && method === 'PATCH') {
      Object.assign(user, parse(updateMeSchema, body));
      return json(200, toUser(user));
    }
    if (path === '/me' && method === 'DELETE') {
      const { password } = parse(deleteAccountSchema, body);
      if ((await hashSecret(user.salt, password)) !== user.passwordHash) throw unauthorized('Password is incorrect');
      const kidIds = new Set(db.children.filter((c) => c.parentId === user.id).map((c) => c.id));
      db.children = db.children.filter((c) => !kidIds.has(c.id));
      db.sessions = db.sessions.filter((s) => !kidIds.has(s.childId));
      db.childStickers = db.childStickers.filter((s) => !kidIds.has(s.childId));
      db.users = db.users.filter((u) => u.id !== user.id);
      revokeAll(db, user.id);
      return json(204);
    }
    if (path === '/me/pin' && method === 'POST') {
      const input = parse(setPinSchema, body);
      if (user.pinHash) {
        if (!input.currentPassword) throw badRequest('Enter your account password to change the PIN');
        if ((await hashSecret(user.salt, input.currentPassword)) !== user.passwordHash) throw unauthorized('Password is incorrect');
      }
      user.pinHash = await hashSecret(user.salt, `pin:${input.pin}`);
      user.pinFailedAttempts = 0;
      user.pinLockedUntil = null;
      return json(204);
    }
    if (path === '/me/pin/verify' && method === 'POST') {
      const { pin } = parse(verifyPinSchema, body);
      if (!user.pinHash) throw badRequest('No PIN has been set yet');
      if (user.pinLockedUntil && new Date(user.pinLockedUntil).getTime() > at.getTime()) {
        throw new HttpError(423, 'PIN_LOCKED', 'Too many tries. Please wait a few minutes.', { lockedUntil: user.pinLockedUntil });
      }
      if ((await hashSecret(user.salt, `pin:${pin}`)) === user.pinHash) {
        user.pinFailedAttempts = 0;
        user.pinLockedUntil = null;
        return json(200, { ok: true });
      }
      const attempts = user.pinFailedAttempts + 1;
      const locked = attempts >= MAX_PIN_ATTEMPTS;
      user.pinFailedAttempts = locked ? 0 : attempts;
      user.pinLockedUntil = locked ? new Date(at.getTime() + PIN_LOCK_MINUTES * 60_000).toISOString() : null;
      await save(db);
      throw new HttpError(401, 'PIN_INCORRECT', 'That PIN is not right', { attemptsLeft: locked ? 0 : MAX_PIN_ATTEMPTS - attempts });
    }
    if (path === '/me/logout-all' && method === 'POST') {
      revokeAll(db, user.id);
      return json(204);
    }
    if (path === '/me/export' && method === 'GET') {
      const kids = db.children.filter((c) => c.parentId === user.id);
      const ids = new Set(kids.map((k) => k.id));
      return json(200, {
        exportedAt: at.toISOString(),
        account: toUser(user),
        children: kids.map(toChild),
        sessions: db.sessions.filter((s) => ids.has(s.childId)).map(toSession),
        stickers: db.childStickers.filter((s) => ids.has(s.childId)),
      });
    }

    // Children.
    if (seg[0] === 'children') {
      if (seg.length === 1 && method === 'GET') {
        return json(200, db.children.filter((c) => c.parentId === user.id).map(toChild));
      }
      if (seg.length === 1 && method === 'POST') {
        const input = parse(createChildSchema, body);
        if (db.children.filter((c) => c.parentId === user.id).length >= MAX_CHILDREN) {
          throw badRequest(`A family can have up to ${MAX_CHILDREN} profiles`);
        }
        const child: DbChild = {
          ...input,
          id: deps.randomId(),
          parentId: user.id,
          stars: 0,
          settings: DEFAULT_CHILD_SETTINGS,
          createdAt: at.toISOString(),
        };
        db.children.push(child);
        return json(201, toChild(child));
      }
      const child = ownedChild(db, user, seg[1] ?? '');
      const sub = seg[2];
      if (!sub && method === 'GET') return json(200, toChild(child));
      if (!sub && method === 'PATCH') {
        Object.assign(child, parse(updateChildSchema, body));
        return json(200, toChild(child));
      }
      if (!sub && method === 'DELETE') {
        db.children = db.children.filter((c) => c.id !== child.id);
        db.sessions = db.sessions.filter((s) => s.childId !== child.id);
        db.childStickers = db.childStickers.filter((s) => s.childId !== child.id);
        return json(204);
      }
      if (sub === 'token' && method === 'POST') {
        const issued = newToken();
        const expiresAt = new Date(at.getTime() + 12 * 60 * 60 * 1000).toISOString();
        db.childTokens = { ...(db.childTokens ?? {}), [issued]: { userId: user.id, childId: child.id, expiresAt } };
        return json(200, { token: issued, expiresAt });
      }
      if (sub === 'settings' && method === 'PATCH') {
        child.settings = { ...child.settings, ...parse(updateChildSettingsSchema, body) };
        return json(200, toChild(child));
      }
      if (sub === 'lock' && method === 'POST') {
        const input = parse(lockChildSchema, body ?? {});
        const until =
          input.minutes !== undefined
            ? new Date(at.getTime() + input.minutes * 60_000)
            : nextOccurrence(child.settings.bedtimeEnd, at, user.timezone);
        child.settings = { ...child.settings, lockedUntil: until.toISOString() };
        return json(200, toChild(child));
      }
      if (sub === 'lock' && method === 'DELETE') {
        child.settings = { ...child.settings, lockedUntil: null };
        return json(200, toChild(child));
      }
      if (sub === 'today' && method === 'GET') return json(200, todayStatus(db, child, user.timezone));
      if (sub === 'insights' && method === 'GET') return json(200, insights(db, child, user.timezone));
      if (sub === 'stickers' && method === 'GET') {
        const owned = db.childStickers
          .filter((s) => s.childId === child.id)
          .sort((a, b) => b.unlockedAt.localeCompare(a.unlockedAt));
        return json(
          200,
          owned.flatMap((o) => {
            const s = db.stickers.find((x) => x.id === o.stickerId);
            return s ? [{ ...s, unlockedAt: o.unlockedAt }] : [];
          }),
        );
      }
    }

    // Catalog.
    if (path === '/catalog' && method === 'GET') {
      let rows = db.content.filter((c) => c.status === 'published');
      if (query.type) rows = rows.filter((c) => c.type === query.type);
      if (query.calm !== undefined) rows = rows.filter((c) => c.calm === (query.calm === 'true'));
      const scoped = childScope();
      if (scoped) {
        if (query.childId && query.childId !== scoped.id) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this');
        rows = rows.filter(allowedFor(scoped));
      } else if (query.childId) {
        throw new HttpError(401, 'CHILD_TOKEN_REQUIRED', 'Choose who is playing first');
      }
      if (query.skill) rows = rows.filter((c) => (c.skills as string[]).includes(query.skill ?? ''));
      rows = [...rows].sort(
        (a, b) =>
          Number(b.featured) - Number(a.featured) ||
          a.ageMin - b.ageMin ||
          (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
      );
      return json(200, rows.map(toSummary));
    }
    if (path === '/catalog/credits' && method === 'GET') {
      const scoped = childScope();
      const videos = db.content
        .filter((c) => c.status === 'published' && c.body.kind === 'video')
        .filter((c) => !scoped || allowedFor(scoped)(c))
        .sort((a, b) => a.slug.localeCompare(b.slug));
      return json(200, videos.flatMap((c) => (c.body.kind === 'video' ? [{ contentId: c.id, title: c.title, credit: c.body.credit }] : [])));
    }
    if (path === '/catalog/continue' && method === 'GET') {
      const child = requireChild(query.childId);
      const since = at.getTime() - 14 * 86_400_000;
      const recent = db.sessions.filter((s) => s.childId === child.id && new Date(s.startedAt).getTime() >= since).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
      const finished = new Set(recent.filter((s) => s.completed).map((s) => s.contentId));
      const ids = [...new Set(recent.filter((s) => !s.completed && !finished.has(s.contentId)).map((s) => s.contentId))];
      const items = ids
        .map((id) => db.content.find((c) => c.id === id && c.status === 'published'))
        .filter((c): c is ContentDetail => !!c && allowedFor(child)(c));
      return json(200, items.slice(0, 6).map(toSummary));
    }
    if (path === '/catalog/recommendations' && method === 'GET') {
      const child = requireChild(query.childId);
      const limit = Math.min(12, Math.max(1, Number(query.limit ?? 6) || 6));
      const published = db.content.filter((c) => c.status === 'published').filter(allowedFor(child)).map(withGroups);
      const history = db.sessions
        .filter((s) => s.childId === child.id)
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .slice(0, 200);
      const picks = recommendContent({ age: child.age, blockedCategories: child.settings.blockedCategories }, published, history, limit);
      return json(200, picks.map((r) => ({ item: toSummary(r.item), becauseSkill: r.becauseSkill })));
    }
    if (seg[0] === 'content' && seg.length === 2 && method === 'GET') {
      const item = db.content.find((c) => c.id === seg[1] && c.status === 'published');
      if (!item) throw notFound('Content');
      const scoped = childScope();
      if (scoped && !allowedFor(scoped)(item)) throw notFound('Content');
      return json(200, withGroups(item));
    }
    if (path === '/stickers' && method === 'GET') return json(200, db.stickers);

    // Play sessions.
    if (path === '/sessions' && method === 'POST') {
      const input = parse(startSessionSchema, body);
      const child = requireChild(input.childId);
      const existing = db.sessions.find((s) => s.clientSessionId === input.clientSessionId);
      if (existing) {
        if (existing.childId !== child.id) throw badRequest('Session id already used');
        return json(200, toSession(existing));
      }
      const item = db.content.find((c) => c.id === input.contentId && c.status === 'published');
      if (!item) throw notFound('Content');
      if (!isForAgeGroup(ageGroupFor(child.age), { ...withGroups(item), videoSeconds: videoSecondsOf(item) })) {
        throw new HttpError(403, 'PLAY_BLOCKED', BLOCK_MESSAGES.age, { reason: 'age', remainingSeconds: null });
      }
      const { date } = localParts(at, user.timezone);
      const policy = evaluatePlayPolicy({
        settings: child.settings,
        secondsPlayedToday: secondsOn(db, child.id, date),
        now: at,
        timeZone: user.timezone,
        childAge: child.age,
        content: { calm: item.calm, ageMin: item.ageMin, type: item.type, skills: item.skills },
      });
      if (!policy.allowed && policy.reason) {
        throw new HttpError(403, 'PLAY_BLOCKED', BLOCK_MESSAGES[policy.reason], {
          reason: policy.reason,
          remainingSeconds: policy.remainingSeconds,
        });
      }
      const session: DbSession = {
        id: deps.randomId(),
        clientSessionId: input.clientSessionId,
        childId: child.id,
        contentId: item.id,
        familyMode: input.familyMode,
        startedAt: at.toISOString(),
        endedAt: null,
        lastActiveAt: at.toISOString(),
        localDate: date,
        secondsPlayed: 0,
        completed: false,
        starsEarned: 0,
        path: [],
      };
      db.sessions.push(session);
      return json(201, { ...toSession(session), remainingSeconds: policy.remainingSeconds });
    }
    if (path === '/sessions/sync' && method === 'POST') {
      const { sessions } = parse(syncSessionsSchema, body);
      const result: SyncResult = { accepted: 0, duplicates: 0, rejected: [] };
      for (const item of sessions) {
        try {
          const child = ownedChild(db, user, item.childId);
          const contentRow = db.content.find((c) => c.id === item.contentId);
          if (!contentRow) throw notFound('Content');
          const dupe = db.sessions.find((s) => s.clientSessionId === item.clientSessionId);
          if (dupe) {
            if (dupe.childId !== child.id) throw badRequest('Session id already used');
            const scored = item.completed && !dupe.completed ? computeStars(contentRow.body, contentRow.rewardStars, item.path, item.answers) : null;
            if (scored?.valid) {
              award(db, dupe, child, contentRow, scored.stars, Math.max(0, item.seconds - dupe.secondsPlayed), item.path, at);
              result.accepted += 1;
            } else {
              dupe.secondsPlayed = Math.max(dupe.secondsPlayed, item.seconds);
              result.duplicates += 1;
            }
            continue;
          }
          const startedAt = new Date(item.startedAt);
          const session: DbSession = {
            id: deps.randomId(),
            clientSessionId: item.clientSessionId,
            childId: child.id,
            contentId: contentRow.id,
            familyMode: item.familyMode,
            startedAt: startedAt.toISOString(),
            endedAt: null,
            lastActiveAt: startedAt.toISOString(),
            localDate: localParts(startedAt, user.timezone).date,
            secondsPlayed: item.seconds,
            completed: false,
            starsEarned: 0,
            path: [],
          };
          db.sessions.push(session);
          const scored = item.completed ? computeStars(contentRow.body, contentRow.rewardStars, item.path, item.answers) : null;
          if (scored?.valid) {
            award(db, session, child, contentRow, scored.stars, 0, item.path, new Date(startedAt.getTime() + item.seconds * 1000));
          }
          result.accepted += 1;
        } catch (error) {
          result.rejected.push({
            clientSessionId: item.clientSessionId,
            reason: error instanceof HttpError ? error.message : 'Could not sync',
          });
        }
      }
      return json(200, result);
    }
    if (seg[0] === 'sessions' && seg.length === 3 && method === 'POST') {
      const session = db.sessions.find((s) => s.id === seg[1]);
      if (!session) throw notFound('Session');
      const child = ownedChild(db, user, session.childId);
      if (seg[2] === 'heartbeat') {
        const { seconds } = parse(heartbeatSchema, body);
        if (session.completed) return json(200, { ...toSession(session), remainingSeconds: null });
        session.secondsPlayed += cappedSeconds(session, seconds, at);
        session.lastActiveAt = at.toISOString();
        const policy = evaluatePlayPolicy({
          settings: child.settings,
          secondsPlayedToday: secondsOn(db, child.id, session.localDate),
          now: at,
          timeZone: user.timezone,
          childAge: child.age,
        });
        return json(200, { ...toSession(session), remainingSeconds: policy.remainingSeconds, blockedReason: policy.reason });
      }
      if (seg[2] === 'complete') {
        const input = parse(completeSessionSchema, body);
        if (session.completed) {
          return json(200, { session: toSession(session), starsEarned: session.starsEarned, totalStars: child.stars, stickerUnlocked: null });
        }
        const item = db.content.find((c) => c.id === session.contentId);
        if (!item) throw notFound('Content');
        const { valid, stars } = computeStars(item.body, item.rewardStars, input.path, input.answers);
        if (!valid) throw badRequest('This adventure has not reached an ending yet');
        return json(200, award(db, session, child, item, stars, cappedSeconds(session, input.seconds, at), input.path, at));
      }
    }

    throw notFound('Route');
  }

  /** A fetch replacement for the shared API client. Requests run one at a time. */
  async function fetchImpl(input: string, init?: RequestInit): Promise<Response> {
    const run = async () => {
      const rest = input.startsWith(LOCAL_BASE_URL) ? input.slice(LOCAL_BASE_URL.length) : input;
      const [path = '/', search = ''] = rest.split('?');
      const method = (init?.method ?? 'GET').toUpperCase();
      const headers = (init?.headers ?? {}) as Record<string, string>;
      const auth = headers.authorization ?? headers.Authorization;
      const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
      const childToken = headers[CHILD_TOKEN_HEADER] ?? null;
      let body: unknown;
      if (typeof init?.body === 'string' && init.body.length > 0) {
        try {
          body = JSON.parse(init.body);
        } catch {
          return json(400, { error: { code: 'BAD_REQUEST', message: 'Invalid JSON' } });
        }
      }
      const db = await load();
      try {
        const res = await route(db, method, path, parseQuery(search), body, token, childToken);
        if (method !== 'GET') await save(db);
        return res;
      } catch (error) {
        if (error instanceof HttpError) {
          return json(error.status, { error: { code: error.code, message: error.message, details: error.details } });
        }
        return json(500, { error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
      }
    };
    const next = queue.then(run, run);
    queue = next.catch(() => undefined);
    return next;
  }

  return { fetch: fetchImpl };
}
