import { randomUUID } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { AuthResponse, Child, ContentSummary } from '@kidzo/shared';
import { buildApp } from '../src/app';
import { loadConfig } from '../src/config';
import { openDatabase, type Database } from '../src/db/client';
import type { Mailer } from '../src/lib/mailer';
import { seed } from '../src/seed';

export const ADMIN = { email: 'admin@test.local', password: 'AdminPass123' };

export interface TestContext {
  app: FastifyInstance;
  database: Database;
  close: () => Promise<void>;
}

/** Captures emails instead of sending them. */
export class CapturingMailer implements Mailer {
  sent: { to: string; link: string }[] = [];
  async sendPasswordReset(to: string, link: string): Promise<void> {
    this.sent.push({ to, link });
  }
}

export async function createTestApp(options: { seed?: boolean; mailer?: Mailer } = {}): Promise<TestContext> {
  const config = loadConfig({
    NODE_ENV: 'test',
    UPLOAD_DIR: mkdtempSync(path.join(tmpdir(), 'kidzo-uploads-')),
    LOG_LEVEL: 'silent',
  });
  const database = await openDatabase({ pgliteDir: 'memory' });
  if (options.seed !== false) {
    await seed(database.db, { adminEmail: ADMIN.email, adminPassword: ADMIN.password, demo: false });
  }
  const app = await buildApp({ config, db: database.db, ...(options.mailer ? { mailer: options.mailer } : {}) });
  await app.ready();
  return {
    app,
    database,
    close: async () => {
      await app.close();
      await database.close();
    },
  };
}

export async function registerParent(app: FastifyInstance, overrides: Record<string, unknown> = {}): Promise<AuthResponse> {
  const res = await app.inject({
    method: 'POST',
    url: '/auth/register',
    payload: {
      email: `parent-${randomUUID()}@test.local`,
      password: 'Sunflower123',
      displayName: 'Amara',
      timezone: 'UTC',
      parentalConsent: true,
      ...overrides,
    },
  });
  if (res.statusCode !== 201) throw new Error(`register failed: ${res.statusCode} ${res.body}`);
  return res.json<AuthResponse>();
}

export async function login(app: FastifyInstance, email: string, password: string): Promise<AuthResponse> {
  const res = await app.inject({ method: 'POST', url: '/auth/login', payload: { email, password } });
  if (res.statusCode !== 200) throw new Error(`login failed: ${res.statusCode} ${res.body}`);
  return res.json<AuthResponse>();
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });

export async function createChild(app: FastifyInstance, token: string, overrides: Record<string, unknown> = {}): Promise<Child> {
  const res = await app.inject({
    method: 'POST',
    url: '/children',
    headers: bearer(token),
    payload: { name: 'Mia', age: 6, avatar: 'fox', ...overrides },
  });
  if (res.statusCode !== 201) throw new Error(`create child failed: ${res.statusCode} ${res.body}`);
  return res.json<Child>();
}

/** Child-scoped token for kid endpoints, as the app requests when a profile is opened. */
export async function childToken(app: FastifyInstance, token: string, childId: string): Promise<string> {
  const res = await app.inject({ method: 'POST', url: `/children/${childId}/token`, headers: bearer(token) });
  if (res.statusCode !== 200) throw new Error(`child token failed: ${res.statusCode} ${res.body}`);
  return res.json<{ token: string }>().token;
}

/** Parent login plus the child header, for requests made on a child's screens. */
export async function asChild(app: FastifyInstance, token: string, childId: string): Promise<Record<string, string>> {
  return { ...bearer(token), 'x-kidzo-child': await childToken(app, token, childId) };
}

/** Catalog as a parent, or as a child when the query names one (`?childId=...`). */
export async function catalog(app: FastifyInstance, token: string, query = ''): Promise<ContentSummary[]> {
  const childId = /childId=([0-9a-f-]{36})/.exec(query)?.[1];
  const headers = childId ? await asChild(app, token, childId) : bearer(token);
  const res = await app.inject({ method: 'GET', url: `/catalog${query}`, headers });
  return res.json<ContentSummary[]>();
}
