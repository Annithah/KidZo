import { z } from 'zod';
import {
  storyChoiceInsightsSchema,
  adminStatsSchema,
  adminUserSchema,
  auditEntrySchema,
  authResponseSchema,
  authTokensSchema,
  contentDetailSchema,
  contentSummarySchema,
  createApiClient,
  mediaUploadResultSchema,
  stickerSchema,
  userSchema,
  ApiError,
  friendlyMessage,
  type AuthTokens,
  type ContentInput,
  type ContentStatus,
  type ContentType,
  type StickerInput,
  type TokenStore,
} from '@kidzo/shared';

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:4000';

const TOKEN_KEY = 'kidzo.admin.tokens';

/** Tokens live in sessionStorage so they disappear when the tab closes. */
export const tokenStore: TokenStore = {
  async get(): Promise<AuthTokens | null> {
    try {
      const raw = sessionStorage.getItem(TOKEN_KEY);
      const parsed = raw ? authTokensSchema.safeParse(JSON.parse(raw)) : null;
      return parsed?.success ? parsed.data : null;
    } catch {
      return null;
    }
  },
  async set(tokens) {
    sessionStorage.setItem(TOKEN_KEY, JSON.stringify(tokens));
  },
  async clear() {
    sessionStorage.removeItem(TOKEN_KEY);
  },
};

let onAuthLost: () => void = () => undefined;
export const setOnAuthLost = (fn: () => void) => {
  onAuthLost = fn;
};

export const client = createApiClient({ baseUrl: API_URL, tokenStore, onAuthLost: () => onAuthLost() });

const detailWithProblems = contentDetailSchema.extend({ problems: z.array(z.string()) });
export type ContentWithProblems = z.infer<typeof detailWithProblems>;

const page = <T extends z.ZodType>(item: T) => z.object({ total: z.number(), items: z.array(item) });

export const api = {
  login: (email: string, password: string) => client.post('/auth/login', { email, password }, { auth: false, schema: authResponseSchema }),
  logout: (refreshToken: string) => client.post('/auth/logout', { refreshToken }, { auth: false }),
  me: () => client.get('/me', { schema: userSchema }),

  stats: () => client.get('/admin/stats', { schema: adminStatsSchema }),
  users: (offset: number, limit = 25) => client.get('/admin/users', { query: { offset, limit }, schema: page(adminUserSchema) }),
  audit: (offset: number, limit = 50) => client.get('/admin/audit', { query: { offset, limit }, schema: z.array(auditEntrySchema) }),

  contentList: (query: { status?: ContentStatus; type?: ContentType; q?: string; offset?: number }) =>
    client.get('/admin/content', { query: { ...query, limit: 50 }, schema: page(contentSummarySchema) }),
  content: (id: string) => client.get(`/admin/content/${id}`, { schema: detailWithProblems }),
  createContent: (input: ContentInput) => client.post('/admin/content', input, { schema: detailWithProblems }),
  updateContent: (id: string, input: ContentInput) => client.request('PUT', `/admin/content/${id}`, { body: input, schema: detailWithProblems }),
  publish: (id: string) => client.post(`/admin/content/${id}/publish`, undefined, { schema: contentSummarySchema }),
  unpublish: (id: string) => client.post(`/admin/content/${id}/unpublish`, undefined, { schema: contentSummarySchema }),
  archive: (id: string) => client.post(`/admin/content/${id}/archive`, undefined, { schema: contentSummarySchema }),
  submit: (id: string) => client.post(`/admin/content/${id}/submit`, undefined, { schema: contentSummarySchema }),
  requestChanges: (id: string) => client.post(`/admin/content/${id}/request-changes`, undefined, { schema: contentSummarySchema }),
  restore: (id: string) => client.post(`/admin/content/${id}/restore`, undefined, { schema: contentSummarySchema }),
  storyChoices: (days: number) => client.get('/admin/analytics/story-choices', { query: { days }, schema: storyChoiceInsightsSchema }),
  deleteContent: (id: string) => client.del(`/admin/content/${id}`),

  stickers: () => client.get('/admin/stickers', { schema: z.array(stickerSchema) }),
  createSticker: (input: StickerInput) => client.post('/admin/stickers', input, { schema: stickerSchema }),
  updateSticker: (id: string, input: StickerInput) => client.request('PUT', `/admin/stickers/${id}`, { body: input, schema: stickerSchema }),
  deleteSticker: (id: string) => client.del(`/admin/stickers/${id}`),

  /** Multipart upload; bypasses the JSON client but reuses its token. */
  async uploadMedia(file: File) {
    const send = async () => {
      const tokens = await tokenStore.get();
      const form = new FormData();
      form.append('file', file);
      return fetch(`${API_URL}/admin/media`, {
        method: 'POST',
        headers: tokens ? { authorization: `Bearer ${tokens.accessToken}` } : {},
        body: form,
      });
    };
    let res = await send();
    if (res.status === 401) {
      await client.get('/me').catch(() => undefined); // triggers a token refresh
      res = await send();
    }
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message = (json as { error?: { message?: string } } | null)?.error?.message ?? 'Upload failed';
      throw new ApiError(message, res.status, 'UPLOAD_FAILED');
    }
    return mediaUploadResultSchema.parse(json);
  },
};

/** Human summary of an API or network failure. Field-level problems are shown under fields. */
export function describeError(error: unknown): { message: string; problems: string[] } {
  if (error instanceof ApiError) {
    if (error.isNetwork) return { message: 'Cannot reach the KIDZO server. Check your connection and try again.', problems: [] };
    const details = Array.isArray(error.details) ? error.details : [];
    const problems = details.map((d) => (typeof d === 'string' ? d : friendlyMessage({ path: (d as { path?: string }).path ?? '', message: (d as { message?: string }).message ?? '' })));
    return { message: error.code === 'VALIDATION_ERROR' ? 'Some fields need attention.' : error.message, problems };
  }
  return { message: error instanceof Error ? error.message : 'Something went wrong', problems: [] };
}
