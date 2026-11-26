/**
 * Typed HTTP client for the KIDZO API. Pure TypeScript (no React Native imports) so it can be
 * unit tested. Handles bearer auth, single-flight token refresh, timeouts and response validation.
 */
import type { z } from 'zod';
import { apiErrorSchema } from './schemas/common';
import { authResponseSchema, type AuthTokens } from './schemas/auth';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** True when the request never reached the server (offline, DNS, timeout). */
  get isNetwork(): boolean {
    return this.status === 0;
  }
}

export interface TokenStore {
  get(): Promise<AuthTokens | null>;
  set(tokens: AuthTokens): Promise<void>;
  clear(): Promise<void>;
}

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export interface ApiClientOptions {
  baseUrl: string;
  tokenStore: TokenStore;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
  /** Called when the refresh token is rejected and the user must sign in again. */
  onAuthLost?: () => void;
}

export interface RequestOptions<S extends z.ZodType | undefined> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
  schema?: S;
  auth?: boolean;
  signal?: AbortSignal;
  /** Extra request headers, for example the child-scoped token. */
  headers?: Record<string, string>;
}

type Result<S> = S extends z.ZodType ? z.infer<S> : unknown;

export interface ApiClient {
  request<S extends z.ZodType | undefined = undefined>(method: string, path: string, options?: RequestOptions<S>): Promise<Result<S>>;
  get<S extends z.ZodType | undefined = undefined>(path: string, options?: RequestOptions<S>): Promise<Result<S>>;
  post<S extends z.ZodType | undefined = undefined>(path: string, body?: unknown, options?: RequestOptions<S>): Promise<Result<S>>;
  patch<S extends z.ZodType | undefined = undefined>(path: string, body?: unknown, options?: RequestOptions<S>): Promise<Result<S>>;
  del<S extends z.ZodType | undefined = undefined>(path: string, body?: unknown, options?: RequestOptions<S>): Promise<Result<S>>;
  baseUrl: string;
}

export function createApiClient(options: ApiClientOptions): ApiClient {
  const fetchImpl: FetchLike = options.fetchImpl ?? ((input, init) => fetch(input, init));
  const timeoutMs = options.timeoutMs ?? 15_000;
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  let refreshing: Promise<AuthTokens | null> | null = null;

  const buildUrl = (path: string, query?: RequestOptions<undefined>['query']) => {
    const params = Object.entries(query ?? {})
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`);
    return `${baseUrl}${path}${params.length ? `?${params.join('&')}` : ''}`;
  };

  async function rawFetch(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const onAbort = () => controller.abort();
    signal?.addEventListener('abort', onAbort);
    try {
      return await fetchImpl(url, { ...init, signal: controller.signal });
    } catch {
      throw new ApiError("Can't reach KIDZO right now. Check your connection.", 0, 'NETWORK');
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    }
  }

  async function refreshTokens(): Promise<AuthTokens | null> {
    const current = await options.tokenStore.get();
    if (!current) return null;
    const res = await rawFetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: current.refreshToken }),
    });
    if (!res.ok) {
      if (res.status === 401) {
        await options.tokenStore.clear();
        options.onAuthLost?.();
      }
      return null;
    }
    const parsed = authResponseSchema.safeParse(await res.json());
    if (!parsed.success) return null;
    await options.tokenStore.set(parsed.data.tokens);
    return parsed.data.tokens;
  }

  /** Concurrent 401s share one refresh call. */
  const refreshOnce = () => {
    refreshing ??= refreshTokens().finally(() => {
      refreshing = null;
    });
    return refreshing;
  };

  async function parseError(res: Response): Promise<ApiError> {
    let payload: unknown = null;
    try {
      payload = await res.json();
    } catch {
      // Non JSON error body.
    }
    const parsed = apiErrorSchema.safeParse(payload);
    if (parsed.success) {
      const { code, message, details } = parsed.data.error;
      return new ApiError(message, res.status, code, details);
    }
    return new ApiError('Something went wrong. Please try again.', res.status, 'UNKNOWN');
  }

  async function request<S extends z.ZodType | undefined = undefined>(
    method: string,
    path: string,
    opts: RequestOptions<S> = {},
  ): Promise<Result<S>> {
    const auth = opts.auth ?? true;
    const send = async (tokens: AuthTokens | null) => {
      const headers: Record<string, string> = { accept: 'application/json', ...opts.headers };
      if (opts.body !== undefined) headers['content-type'] = 'application/json';
      if (auth && tokens) headers.authorization = `Bearer ${tokens.accessToken}`;
      return rawFetch(
        buildUrl(path, opts.query),
        { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined },
        opts.signal,
      );
    };

    let res = await send(auth ? await options.tokenStore.get() : null);
    if (res.status === 401 && auth) {
      const fresh = await refreshOnce();
      if (fresh) res = await send(fresh);
    }
    if (!res.ok) throw await parseError(res);
    if (res.status === 204) return undefined as Result<S>;

    const json: unknown = await res.json();
    if (!opts.schema) return json as Result<S>;
    const parsed = opts.schema.safeParse(json);
    if (!parsed.success) {
      throw new ApiError('The server sent something unexpected. Please update the app.', res.status, 'BAD_RESPONSE');
    }
    return parsed.data as Result<S>;
  }

  return {
    baseUrl,
    request,
    get: (path, o) => request('GET', path, o),
    post: (path, body, o) => request('POST', path, { ...o, body }),
    patch: (path, body, o) => request('PATCH', path, { ...o, body }),
    del: (path, body, o) => request('DELETE', path, { ...o, body }),
  };
}
