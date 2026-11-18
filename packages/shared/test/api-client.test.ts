import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AuthTokens } from '../src';
import { ApiError, createApiClient, type TokenStore } from '../src';

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function memoryTokens(initial: AuthTokens | null): TokenStore & { value: AuthTokens | null } {
  const store = {
    value: initial,
    get: async () => store.value,
    set: async (t: AuthTokens) => {
      store.value = t;
    },
    clear: async () => {
      store.value = null;
    },
  };
  return store;
}

const tokens = (n: number): AuthTokens => ({ accessToken: `access-${n}`, refreshToken: `refresh-token-number-${n}-xxxxxxxx`, expiresIn: 900 });
const user = {
  id: '6f1c2a8e-4f3b-4c1a-9a43-2b8f0d1e7c11',
  email: 'a@b.c',
  displayName: 'A',
  role: 'parent',
  locale: 'en',
  timezone: 'UTC',
  hasPin: false,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('api client', () => {
  it('sends the bearer token and validates responses', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      expect((init?.headers as Record<string, string>).authorization).toBe('Bearer access-1');
      return json(200, { ok: true });
    });
    const client = createApiClient({ baseUrl: 'http://api/', tokenStore: memoryTokens(tokens(1)), fetchImpl });
    await expect(client.get('/me', { schema: z.object({ ok: z.boolean() }) })).resolves.toEqual({ ok: true });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://api/me');
  });

  it('refreshes once on 401 and retries', async () => {
    const store = memoryTokens(tokens(1));
    let refreshCalls = 0;
    const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1;
        return json(200, { user, tokens: tokens(2) });
      }
      const auth = (init?.headers as Record<string, string>).authorization;
      return auth === 'Bearer access-2' ? json(200, { ok: true }) : json(401, { error: { code: 'UNAUTHORIZED', message: 'x' } });
    });
    const client = createApiClient({ baseUrl: 'http://api', tokenStore: store, fetchImpl });
    const results = await Promise.all([client.get('/a'), client.get('/b'), client.get('/c')]);
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }]);
    expect(refreshCalls).toBe(1);
    expect(store.value?.accessToken).toBe('access-2');
  });

  it('signals lost auth when refresh is rejected', async () => {
    const store = memoryTokens(tokens(1));
    const onAuthLost = vi.fn();
    const fetchImpl = vi.fn(async () => json(401, { error: { code: 'UNAUTHORIZED', message: 'Please sign in again' } }));
    const client = createApiClient({ baseUrl: 'http://api', tokenStore: store, fetchImpl, onAuthLost });
    await expect(client.get('/me')).rejects.toMatchObject({ status: 401 });
    expect(onAuthLost).toHaveBeenCalledOnce();
    expect(store.value).toBeNull();
  });

  it('maps API errors and network failures', async () => {
    const client = createApiClient({
      baseUrl: 'http://api',
      tokenStore: memoryTokens(null),
      fetchImpl: async () => json(403, { error: { code: 'PLAY_BLOCKED', message: 'Bedtime', details: { reason: 'bedtime' } } }),
    });
    const err = await client.post('/sessions', {}).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 403, code: 'PLAY_BLOCKED', details: { reason: 'bedtime' } });

    const offline = createApiClient({
      baseUrl: 'http://api',
      tokenStore: memoryTokens(null),
      fetchImpl: async () => {
        throw new TypeError('Network request failed');
      },
    });
    const netErr = await offline.get('/health').catch((e: unknown) => e);
    expect((netErr as ApiError).isNetwork).toBe(true);
  });

  it('builds query strings and handles 204', async () => {
    const fetchImpl = vi.fn(async (_url: string) => new Response(null, { status: 204 }));
    const client = createApiClient({ baseUrl: 'http://api', tokenStore: memoryTokens(null), fetchImpl });
    await expect(client.get('/catalog', { query: { childId: 'a b', calm: true, skip: undefined } })).resolves.toBeUndefined();
    expect(fetchImpl.mock.calls[0]?.[0]).toBe('http://api/catalog?childId=a%20b&calm=true');
  });
});
