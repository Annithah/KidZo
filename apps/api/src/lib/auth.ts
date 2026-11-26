import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { and, eq, isNull } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { AuthTokens, Role } from '@kidzo/shared';
import { refreshTokens, users } from '../db/schema';
import { forbidden, unauthorized } from './errors';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    /** `scope: 'child'` marks a child-scoped token (see lib/child-scope.ts); it is never a login. */
    payload: { sub: string; role: Role; scope?: 'child'; childId?: string };
    user: { sub: string; role: Role; scope?: 'child'; childId?: string };
  }
}

const ARGON_OPTIONS = { memoryCost: 19_456, timeCost: 2, parallelism: 1 } as const;

export const hashSecret = (secret: string) => hash(secret, ARGON_OPTIONS);

export async function verifySecret(hashValue: string, secret: string): Promise<boolean> {
  try {
    return await verify(hashValue, secret);
  } catch {
    return false;
  }
}

/** Equalizes login timing for unknown emails. */
let dummyHash: Promise<string> | undefined;
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashSecret('kidzo-timing-equalizer-1');
  await verifySecret(await dummyHash, password);
}

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export async function issueTokens(app: FastifyInstance, user: { id: string; role: Role }): Promise<AuthTokens> {
  const { config, db } = app;
  const accessToken = app.jwt.sign(
    { sub: user.id, role: user.role },
    { expiresIn: config.ACCESS_TOKEN_TTL_SECONDS },
  );
  const refreshToken = randomBytes(32).toString('base64url');
  await db.insert(refreshTokens).values({
    userId: user.id,
    tokenHash: sha256(refreshToken),
    expiresAt: new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 86_400_000),
  });
  return { accessToken, refreshToken, expiresIn: config.ACCESS_TOKEN_TTL_SECONDS };
}

/**
 * Rotates a refresh token. Reusing a token that was already rotated revokes every session for
 * that account, since it suggests the token was stolen.
 */
export async function rotateRefreshToken(app: FastifyInstance, token: string): Promise<{ userId: string; tokens: AuthTokens }> {
  const { db } = app;
  const [row] = await db.select().from(refreshTokens).where(eq(refreshTokens.tokenHash, sha256(token))).limit(1);
  if (!row) throw unauthorized();
  if (row.revokedAt) {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(and(eq(refreshTokens.userId, row.userId), isNull(refreshTokens.revokedAt)));
    throw unauthorized();
  }
  if (row.expiresAt.getTime() <= Date.now()) throw unauthorized();

  const [user] = await db.select({ id: users.id, role: users.role }).from(users).where(eq(users.id, row.userId)).limit(1);
  if (!user) throw unauthorized();
  await db.update(refreshTokens).set({ revokedAt: new Date() }).where(eq(refreshTokens.id, row.id));
  return { userId: user.id, tokens: await issueTokens(app, user) };
}

export async function revokeRefreshToken(app: FastifyInstance, token: string): Promise<void> {
  await app.db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.tokenHash, sha256(token)), isNull(refreshTokens.revokedAt)));
}

export async function revokeAllForUser(app: FastifyInstance, userId: string): Promise<void> {
  await app.db
    .update(refreshTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(refreshTokens.userId, userId), isNull(refreshTokens.revokedAt)));
}

/** preHandler: requires a valid access token for an account that still exists. */
export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify();
  } catch {
    throw unauthorized();
  }
  // A child-scoped token only travels in the child header; it can never act as a parent login.
  if (request.user.scope === 'child') throw unauthorized();
  const [user] = await request.server.db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, request.user.sub))
    .limit(1);
  if (!user) throw unauthorized();
}

/** preHandler: requires an admin. Role is re-read from the database so demotions apply immediately. */
export async function requireAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  await requireAuth(request, reply);
  const [user] = await request.server.db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, request.user.sub))
    .limit(1);
  if (user?.role !== 'admin') throw forbidden();
}
