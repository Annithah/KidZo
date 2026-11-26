import { describe, expect, it } from 'vitest';
import { CHILD_TOKEN_HEADER, categoryOf, createApiClient, type ApiClient, type AuthTokens, type ContentSummary } from '@kidzo/shared';
import { memoryStore } from '../kv';
import { createLocalBackend, DEMO_PARENT, LOCAL_BASE_URL } from '../local-backend/server';

const randomUUID = () => globalThis.crypto.randomUUID();
const sha256 = async (v: string) => {
  const buf = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(v));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
};

function setup(now = () => new Date('2026-11-18T09:00:00Z')) {
  const store = memoryStore();
  const backend = createLocalBackend({
    store,
    randomId: randomUUID,
    digest: sha256,
    now,
  });
  let tokens: AuthTokens | null = null;
  const client = createApiClient({
    baseUrl: LOCAL_BASE_URL,
    fetchImpl: backend.fetch,
    tokenStore: { get: async () => tokens, set: async (t) => void (tokens = t), clear: async () => void (tokens = null) },
  });
  return { client, store, setTokens: (t: AuthTokens) => (tokens = t) };
}

/** Child header, as the app sends on kid screens. */
async function kid(client: ApiClient, childId: string) {
  const { token } = (await client.post(`/children/${childId}/token`)) as { token: string };
  return { [CHILD_TOKEN_HEADER]: token };
}

describe('local backend', () => {
  it('signs in the demo parent and plays a song to completion', async () => {
    const { client, setTokens } = setup();
    const auth = (await client.post('/auth/login', { email: DEMO_PARENT.email, password: DEMO_PARENT.password }, { auth: false })) as {
      tokens: AuthTokens;
    };
    setTokens(auth.tokens);
    const kids = (await client.get('/children')) as { id: string; name: string }[];
    expect(kids.map((k) => k.name)).toEqual(['Mia', 'Kayla']);
    expect(await client.post('/me/pin/verify', { pin: DEMO_PARENT.pin })).toEqual({ ok: true });

    const kayla = kids[1]!;
    const catalog = (await client.get('/catalog', { query: { childId: kayla.id }, headers: await kid(client, kayla.id) })) as ContentSummary[];
    expect(catalog.length).toBeGreaterThan(0);
    const song = (await client.get('/catalog', { query: { type: 'song' } })) as ContentSummary[];
    const first = song[0]!;
    const session = (await client.post('/sessions', {
      childId: kayla.id,
      contentId: first.id,
      familyMode: false,
      clientSessionId: randomUUID(),
    }, { headers: await kid(client, kayla.id) })) as { id: string };
    const done = (await client.post(`/sessions/${session.id}/complete`, { seconds: 5, path: [] })) as { starsEarned: number; totalStars: number };
    expect(done.totalStars).toBe(done.starsEarned);
    const stickers = (await client.get(`/children/${kayla.id}/stickers`)) as unknown[];
    expect(stickers.length).toBe(first.rewardStickerId ? 1 : 0);
  });

  it('applies blocked categories and serves recommendations offline', async () => {
    const { client, setTokens } = setup();
    const auth = (await client.post('/auth/login', { email: DEMO_PARENT.email, password: DEMO_PARENT.password }, { auth: false })) as {
      tokens: AuthTokens;
    };
    setTokens(auth.tokens);
    const kayla = ((await client.get('/children')) as { id: string }[])[1]!;
    const before = (await client.get('/catalog', { query: { childId: kayla.id }, headers: await kid(client, kayla.id) })) as ContentSummary[];
    const song = before[0];
    expect(song).toBeDefined();
    const blocked = categoryOf(song!);

    const updated = (await client.patch(`/children/${kayla.id}/settings`, { blockedCategories: [blocked] })) as {
      settings: { blockedCategories: string[] };
    };
    expect(updated.settings.blockedCategories).toEqual([blocked]);
    const after = (await client.get('/catalog', { query: { childId: kayla.id }, headers: await kid(client, kayla.id) })) as ContentSummary[];
    expect(after.some((c) => categoryOf(c) === blocked)).toBe(false);
    expect(after.length).toBeGreaterThan(0);
    await expect(
      client.post('/sessions', { childId: kayla.id, contentId: song!.id, familyMode: false, clientSessionId: randomUUID() }, { headers: await kid(client, kayla.id) }),
    ).rejects.toMatchObject({ status: 403 });

    const picks = (await client.get('/catalog/recommendations', { headers: await kid(client, kayla.id) })) as { item: ContentSummary }[];
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.some((p) => categoryOf(p.item) === blocked)).toBe(false);
  });

  it('rejects a wrong password and unknown tokens', async () => {
    const { client } = setup();
    await expect(client.post('/auth/login', { email: DEMO_PARENT.email, password: 'nope' }, { auth: false })).rejects.toMatchObject({ status: 401 });
    await expect(client.get('/children')).rejects.toMatchObject({ status: 401 });
  });

  it('keeps data across restarts', async () => {
    const { client, store, setTokens } = setup();
    const reg = (await client.post(
      '/auth/register',
      { email: 'new@kidzo.local', password: 'Password1234', displayName: 'Sam', parentalConsent: true },
      { auth: false },
    )) as { tokens: AuthTokens };
    setTokens(reg.tokens);
    await client.post('/children', { name: 'Leo', age: 4, avatar: 'lion' });
    const again = createLocalBackend({ store, randomId: randomUUID, digest: sha256 });
    const res = await again.fetch(`${LOCAL_BASE_URL}/children`, { headers: { authorization: `Bearer ${reg.tokens.accessToken}` } });
    expect(((await res.json()) as { name: string }[]).map((c) => c.name)).toEqual(['Leo']);
  });
});
