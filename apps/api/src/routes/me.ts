import { eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { deleteAccountSchema, setPinSchema, updateMeSchema, verifyPinSchema } from '@kidzo/shared';
import { childStickers, children, playSessions, users } from '../db/schema';
import { hashSecret, requireAuth, revokeAllForUser, verifySecret } from '../lib/auth';
import { audit } from '../lib/audit';
import { AppError, badRequest, notFound, parse, unauthorized } from '../lib/errors';
import { toChild, toSession, toUser } from '../lib/serialize';

const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCK_MINUTES = 5;

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', requireAuth);

  const loadUser = async (id: string) => {
    const [user] = await app.db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!user) throw unauthorized();
    return user;
  };

  app.get('/me', async (request) => toUser(await loadUser(request.user.sub)));

  app.patch('/me', async (request) => {
    const input = parse(updateMeSchema, request.body);
    const [user] = await app.db
      .update(users)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(users.id, request.user.sub))
      .returning();
    if (!user) throw unauthorized();
    return toUser(user);
  });

  /** Sets or changes the 4 digit parent PIN that guards the parent area on the device. */
  app.post('/me/pin', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const input = parse(setPinSchema, request.body);
    const user = await loadUser(request.user.sub);
    if (user.pinHash) {
      if (!input.currentPassword) throw badRequest('Enter your account password to change the PIN');
      if (!(await verifySecret(user.passwordHash, input.currentPassword))) throw unauthorized('Password is incorrect');
    }
    await app.db
      .update(users)
      .set({ pinHash: await hashSecret(input.pin), pinFailedAttempts: 0, pinLockedUntil: null, updatedAt: new Date() })
      .where(eq(users.id, user.id));
    await audit(app.db, { actorId: user.id, action: 'pin.set', entity: 'user', entityId: user.id });
    return reply.status(204).send();
  });

  app.post('/me/pin/verify', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request) => {
    const { pin } = parse(verifyPinSchema, request.body);
    const user = await loadUser(request.user.sub);
    if (!user.pinHash) throw badRequest('No PIN has been set yet');
    if (user.pinLockedUntil && user.pinLockedUntil.getTime() > Date.now()) {
      throw new AppError(423, 'PIN_LOCKED', 'Too many tries. Please wait a few minutes.', {
        lockedUntil: user.pinLockedUntil.toISOString(),
      });
    }
    const ok = await verifySecret(user.pinHash, pin);
    if (ok) {
      await app.db.update(users).set({ pinFailedAttempts: 0, pinLockedUntil: null }).where(eq(users.id, user.id));
      return { ok: true };
    }
    const attempts = user.pinFailedAttempts + 1;
    const locked = attempts >= MAX_PIN_ATTEMPTS;
    await app.db
      .update(users)
      .set({
        pinFailedAttempts: locked ? 0 : attempts,
        pinLockedUntil: locked ? new Date(Date.now() + PIN_LOCK_MINUTES * 60_000) : null,
      })
      .where(eq(users.id, user.id));
    throw new AppError(401, 'PIN_INCORRECT', 'That PIN is not right', {
      attemptsLeft: locked ? 0 : MAX_PIN_ATTEMPTS - attempts,
    });
  });

  app.post('/me/logout-all', async (request, reply) => {
    await revokeAllForUser(app, request.user.sub);
    return reply.status(204).send();
  });

  /** Full export of the family's data (privacy right of access). */
  app.get('/me/export', async (request) => {
    const user = await loadUser(request.user.sub);
    const kids = await app.db.select().from(children).where(eq(children.parentId, user.id));
    const ids = kids.map((k) => k.id);
    const sessions = ids.length ? await app.db.select().from(playSessions).where(inArray(playSessions.childId, ids)) : [];
    const stickersOwned = ids.length
      ? await app.db.select().from(childStickers).where(inArray(childStickers.childId, ids))
      : [];
    return {
      exportedAt: new Date().toISOString(),
      account: toUser(user),
      children: kids.map(toChild),
      sessions: sessions.map(toSession),
      stickers: stickersOwned.map((s) => ({ childId: s.childId, stickerId: s.stickerId, unlockedAt: s.unlockedAt.toISOString() })),
    };
  });

  /** Permanently deletes the account and every child profile and play record (privacy right to delete). */
  app.delete('/me', async (request, reply) => {
    const { password } = parse(deleteAccountSchema, request.body);
    const user = await loadUser(request.user.sub);
    if (!(await verifySecret(user.passwordHash, password))) throw unauthorized('Password is incorrect');
    if (user.role === 'admin') throw badRequest('Admin accounts must be removed by another admin');
    const deleted = await app.db.delete(users).where(eq(users.id, user.id)).returning({ id: users.id });
    if (deleted.length === 0) throw notFound('Account');
    await audit(app.db, { actorId: null, action: 'account.delete', entity: 'user', entityId: user.id });
    return reply.status(204).send();
  });
}
