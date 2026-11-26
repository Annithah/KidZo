/** App-wide API client and typed endpoint functions. */
import { z } from 'zod';
import {
  authResponseSchema,
  childSchema,
  childStickerSchema,
  completionResultSchema,
  contentDetailSchema,
  CHILD_TOKEN_HEADER,
  contentSummarySchema,
  recommendationSchema,
  videoCreditEntrySchema,
  guestPlaybackSchema,
  insightsSchema,
  sessionSchema,
  stickerSchema,
  syncResultSchema,
  todayStatusSchema,
  userSchema,
  type CompleteSessionInput,
  type ContentType,
  type CreateChildInput,
  type GuestPlaybackInput,
  type LoginInput,
  type OfflineSession,
  type RegisterInput,
  type StartSessionInput,
  type UpdateChildInput,
  type UpdateChildSettingsInput,
  type UpdateMeInput,
} from '@kidzo/shared';
import { createApiClient } from '@kidzo/shared';
import { API_URL, LOCAL_BACKEND } from './config';
import { LOCAL_BASE_URL, localBackend } from './local-backend';
import { tokenStore } from './storage';

type AuthLostListener = () => void;
const authLostListeners = new Set<AuthLostListener>();
export const onAuthLost = (fn: AuthLostListener) => {
  authLostListeners.add(fn);
  return () => {
    authLostListeners.delete(fn);
  };
};

export const client = createApiClient({
  baseUrl: LOCAL_BACKEND ? LOCAL_BASE_URL : API_URL,
  fetchImpl: LOCAL_BACKEND ? localBackend.fetch : undefined,
  tokenStore,
  onAuthLost: () => authLostListeners.forEach((fn) => fn()),
});

const startedSessionSchema = sessionSchema.extend({ remainingSeconds: z.number().int().nullable().optional() });
const heartbeatResultSchema = sessionSchema.extend({
  remainingSeconds: z.number().int().nullable(),
  blockedReason: z.string().nullable().optional(),
});

const childTokenSchema = z.object({ token: z.string(), expiresAt: z.string() });

/** Child-scoped tokens by child id, refreshed a few minutes before they expire. */
const childTokens = new Map<string, { token: string; expiresAt: number }>();

/** Header naming the child for kid requests. The server reads the age group from it. */
async function kidHeaders(childId: string | undefined): Promise<Record<string, string> | undefined> {
  if (!childId) return undefined;
  const cached = childTokens.get(childId);
  if (cached && cached.expiresAt - Date.now() > 5 * 60_000) return { [CHILD_TOKEN_HEADER]: cached.token };
  const fresh = await api.childToken(childId);
  childTokens.set(childId, { token: fresh.token, expiresAt: new Date(fresh.expiresAt).getTime() });
  return { [CHILD_TOKEN_HEADER]: fresh.token };
}

/** Forget child tokens, for example on sign out. */
export const clearChildTokens = () => childTokens.clear();

export const api = {
  register: (input: RegisterInput) => client.post('/auth/register', input, { auth: false, schema: authResponseSchema }),
  login: (input: LoginInput) => client.post('/auth/login', input, { auth: false, schema: authResponseSchema }),
  logout: (refreshToken: string) => client.post('/auth/logout', { refreshToken }, { auth: false }),
  forgotPassword: (email: string) => client.post('/auth/password/forgot', { email }, { auth: false }),
  resetPassword: (token: string, password: string) => client.post('/auth/password/reset', { token, password }, { auth: false }),

  me: () => client.get('/me', { schema: userSchema }),
  updateMe: (input: UpdateMeInput) => client.patch('/me', input, { schema: userSchema }),
  setPin: (pin: string, currentPassword?: string) => client.post('/me/pin', { pin, currentPassword }),
  verifyPin: (pin: string) => client.post('/me/pin/verify', { pin }, { schema: z.object({ ok: z.boolean() }) }),
  exportData: () => client.get('/me/export'),
  deleteAccount: (password: string) => client.del('/me', { password }),

  children: () => client.get('/children', { schema: z.array(childSchema) }),
  createChild: (input: CreateChildInput) => client.post('/children', input, { schema: childSchema }),
  updateChild: (id: string, input: UpdateChildInput) => client.patch(`/children/${id}`, input, { schema: childSchema }),
  deleteChild: (id: string) => client.del(`/children/${id}`),
  updateSettings: (id: string, input: UpdateChildSettingsInput) =>
    client.patch(`/children/${id}/settings`, input, { schema: childSchema }),
  lockChild: (id: string, minutes?: number) => client.post(`/children/${id}/lock`, minutes ? { minutes } : {}, { schema: childSchema }),
  unlockChild: (id: string) => client.del(`/children/${id}/lock`, undefined, { schema: childSchema }),
  today: (id: string) => client.get(`/children/${id}/today`, { schema: todayStatusSchema }),
  insights: (id: string) => client.get(`/children/${id}/insights`, { schema: insightsSchema }),
  childStickers: (id: string) => client.get(`/children/${id}/stickers`, { schema: z.array(childStickerSchema) }),

  childToken: (id: string) => client.post(`/children/${id}/token`, undefined, { schema: childTokenSchema }),
  /** With a child, the server filters by that child's age group and the parent's blocks. */
  catalog: async (query: { childId?: string; type?: ContentType; calm?: boolean }) =>
    client.get('/catalog', { query, schema: z.array(contentSummarySchema), headers: await kidHeaders(query.childId) }),
  /** Pass the child when a child opens it; without one (parent downloads) no age gate applies. */
  content: async (id: string, childId?: string) =>
    client.get(`/content/${id}`, { schema: contentDetailSchema, headers: await kidHeaders(childId) }),
  continueWatching: async (childId: string) =>
    client.get('/catalog/continue', { schema: z.array(contentSummarySchema), headers: await kidHeaders(childId) }),
  recommendations: async (childId: string) =>
    client.get('/catalog/recommendations', { schema: z.array(recommendationSchema), headers: await kidHeaders(childId) }),
  credits: () => client.get('/catalog/credits', { schema: z.array(videoCreditEntrySchema) }),
  guestCatalog: (age: number) => client.post('/guest/catalog', { age }, { auth: false, schema: z.array(contentSummarySchema) }),
  guestContent: (id: string, age: number) =>
    client.post(`/guest/content/${id}`, { age }, { auth: false, schema: contentDetailSchema }),
  guestPlayback: (input: GuestPlaybackInput) => client.post('/guest/playback', guestPlaybackSchema.parse(input), { auth: false }),
  stickers: () => client.get('/stickers', { schema: z.array(stickerSchema) }),

  startSession: async (input: StartSessionInput) =>
    client.post('/sessions', input, { schema: startedSessionSchema, headers: await kidHeaders(input.childId) }),
  heartbeat: (id: string, seconds: number) => client.post(`/sessions/${id}/heartbeat`, { seconds }, { schema: heartbeatResultSchema }),
  completeSession: (id: string, input: CompleteSessionInput) =>
    client.post(`/sessions/${id}/complete`, input, { schema: completionResultSchema }),
  syncSessions: (sessions: OfflineSession[]) => client.post('/sessions/sync', { sessions }, { schema: syncResultSchema }),
};
