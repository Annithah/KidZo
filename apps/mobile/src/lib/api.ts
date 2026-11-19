/** App-wide API client and typed endpoint functions. */
import { z } from 'zod';
import {
  authResponseSchema,
  childSchema,
  childStickerSchema,
  completionResultSchema,
  contentDetailSchema,
  contentSummarySchema,
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
import { API_URL } from './config';
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
  baseUrl: API_URL,
  tokenStore,
  onAuthLost: () => authLostListeners.forEach((fn) => fn()),
});

const startedSessionSchema = sessionSchema.extend({ remainingSeconds: z.number().int().nullable().optional() });
const heartbeatResultSchema = sessionSchema.extend({
  remainingSeconds: z.number().int().nullable(),
  blockedReason: z.string().nullable().optional(),
});

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

  catalog: (query: { childId?: string; type?: ContentType; calm?: boolean }) =>
    client.get('/catalog', { query, schema: z.array(contentSummarySchema) }),
  content: (id: string) => client.get(`/content/${id}`, { schema: contentDetailSchema }),
  guestCatalog: (age: number) => client.post('/guest/catalog', { age }, { auth: false, schema: z.array(contentSummarySchema) }),
  guestContent: (id: string, age: number) =>
    client.post(`/guest/content/${id}`, { age }, { auth: false, schema: contentDetailSchema }),
  guestPlayback: (input: GuestPlaybackInput) => client.post('/guest/playback', guestPlaybackSchema.parse(input), { auth: false }),
  stickers: () => client.get('/stickers', { schema: z.array(stickerSchema) }),

  startSession: (input: StartSessionInput) => client.post('/sessions', input, { schema: startedSessionSchema }),
  heartbeat: (id: string, seconds: number) => client.post(`/sessions/${id}/heartbeat`, { seconds }, { schema: heartbeatResultSchema }),
  completeSession: (id: string, input: CompleteSessionInput) =>
    client.post(`/sessions/${id}/complete`, input, { schema: completionResultSchema }),
  syncSessions: (sessions: OfflineSession[]) => client.post('/sessions/sync', { sessions }, { schema: syncResultSchema }),
};
