import { createHash, randomBytes } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { forgotPasswordSchema, loginSchema, refreshSchema, registerSchema, resetPasswordSchema } from '@kidzo/shared';
import { passwordResetTokens, users } from '../db/schema';
import {
  burnPasswordCheck,
  hashSecret,
  issueTokens,
  revokeAllForUser,
  revokeRefreshToken,
  rotateRefreshToken,
  verifySecret,
} from '../lib/auth';
import { audit } from '../lib/audit';
import { AppError, badRequest, conflict, parse, unauthorized } from '../lib/errors';
import { toUser } from '../lib/serialize';

const authRateLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };
const RESET_TTL_MINUTES = 30;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post('/auth/register', { config: authRateLimit }, async (request, reply) => {
    const input = parse(registerSchema, request.body);
    const existing = await app.db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    if (existing.length > 0) throw conflict('An account with this email already exists');

    const [user] = await app.db
      .insert(users)
      .values({
        email: input.email,
        passwordHash: await hashSecret(input.password),
        displayName: input.displayName,
        locale: input.locale,
        timezone: input.timezone,
        consentAt: new Date(),
      })
      .returning();
    if (!user) throw new AppError(500, 'INTERNAL', 'Could not create account');
    await audit(app.db, { actorId: user.id, action: 'account.register', entity: 'user', entityId: user.id });
    const tokens = await issueTokens(app, user);
    return reply.status(201).send({ user: toUser(user), tokens });
  });

  app.post('/auth/login', { config: authRateLimit }, async (request) => {
    const input = parse(loginSchema, request.body);
    const [user] = await app.db.select().from(users).where(eq(users.email, input.email)).limit(1);
    if (!user) {
      await burnPasswordCheck(input.password);
      throw unauthorized('Email or password is incorrect');
    }
    if (!(await verifySecret(user.passwordHash, input.password))) {
      throw unauthorized('Email or password is incorrect');
    }
    const tokens = await issueTokens(app, user);
    return { user: toUser(user), tokens };
  });

  app.post('/auth/refresh', { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } }, async (request) => {
    const { refreshToken } = parse(refreshSchema, request.body);
    const { userId, tokens } = await rotateRefreshToken(app, refreshToken);
    const [user] = await app.db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (!user) throw unauthorized();
    return { user: toUser(user), tokens };
  });

  app.post('/auth/logout', async (request, reply) => {
    const { refreshToken } = parse(refreshSchema, request.body);
    await revokeRefreshToken(app, refreshToken);
    return reply.status(204).send();
  });
  /** Always answers 202 so the response does not reveal which emails have accounts. */
  app.post('/auth/password/forgot', { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } }, async (request, reply) => {
    const { email } = parse(forgotPasswordSchema, request.body);
    const [user] = await app.db.select({ id: users.id, email: users.email }).from(users).where(eq(users.email, email)).limit(1);
    if (user) {
      const token = randomBytes(32).toString('base64url');
      await app.db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash: sha256(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000),
      });
      const separator = app.config.PASSWORD_RESET_URL.includes('?') ? '&' : '?';
      await app.mailer.sendPasswordReset(user.email, `${app.config.PASSWORD_RESET_URL}${separator}token=${token}`);
      await audit(app.db, { actorId: user.id, action: 'password.reset_requested', entity: 'user', entityId: user.id });
    }
    return reply.status(202).send({ ok: true });
  });

  /** Sets a new password from a reset link and signs out every device. */
  app.post('/auth/password/reset', { config: authRateLimit }, async (request, reply) => {
    const { token, password } = parse(resetPasswordSchema, request.body);
    const [row] = await app.db
      .select()
      .from(passwordResetTokens)
      .where(and(eq(passwordResetTokens.tokenHash, sha256(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, new Date())))
      .limit(1);
    if (!row) throw badRequest('This reset link has expired. Please request a new one.');
    await app.db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, row.id));
    await app.db
      .update(users)
      .set({ passwordHash: await hashSecret(password), updatedAt: new Date() })
      .where(eq(users.id, row.userId));
    await revokeAllForUser(app, row.userId);
    await audit(app.db, { actorId: row.userId, action: 'password.reset', entity: 'user', entityId: row.userId });
    return reply.status(204).send();
  });
}
