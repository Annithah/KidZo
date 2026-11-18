import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AuthResponse } from '@kidzo/shared';
import { CapturingMailer, bearer, createTestApp, login, registerParent, type TestContext } from './helpers';

let ctx: TestContext;
const mailer = new CapturingMailer();
beforeAll(async () => {
  ctx = await createTestApp({ seed: false, mailer });
});
afterAll(async () => ctx.close());

describe('auth', () => {
  it('registers a parent and returns tokens', async () => {
    const { user, tokens } = await registerParent(ctx.app, { email: 'Jay@Example.com' });
    expect(user.email).toBe('jay@example.com');
    expect(user.role).toBe('parent');
    expect(user.hasPin).toBe(false);
    expect(tokens.accessToken).toBeTruthy();
    expect(tokens.refreshToken.length).toBeGreaterThan(20);
  });

  it('requires parental consent and a strong password', async () => {
    const noConsent = await ctx.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'a@test.local', password: 'Sunflower123', displayName: 'A', parentalConsent: false },
    });
    expect(noConsent.statusCode).toBe(400);
    const weak = await ctx.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'b@test.local', password: 'short', displayName: 'B', parentalConsent: true },
    });
    expect(weak.statusCode).toBe(400);
    expect(weak.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects duplicate emails', async () => {
    await registerParent(ctx.app, { email: 'dupe@test.local' });
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'dupe@test.local', password: 'Sunflower123', displayName: 'X', parentalConsent: true },
    });
    expect(res.statusCode).toBe(409);
  });

  it('logs in and rejects wrong passwords with the same message as unknown emails', async () => {
    await registerParent(ctx.app, { email: 'login@test.local' });
    const ok = await login(ctx.app, 'login@test.local', 'Sunflower123');
    expect(ok.user.email).toBe('login@test.local');
    const wrong = await ctx.app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'login@test.local', password: 'nope' } });
    const unknown = await ctx.app.inject({ method: 'POST', url: '/auth/login', payload: { email: 'ghost@test.local', password: 'nope' } });
    expect(wrong.statusCode).toBe(401);
    expect(unknown.statusCode).toBe(401);
    expect(wrong.json().error.message).toBe(unknown.json().error.message);
  });

  it('protects routes and accepts valid tokens', async () => {
    expect((await ctx.app.inject({ method: 'GET', url: '/me' })).statusCode).toBe(401);
    expect((await ctx.app.inject({ method: 'GET', url: '/me', headers: bearer('garbage') })).statusCode).toBe(401);
    const { tokens } = await registerParent(ctx.app);
    const me = await ctx.app.inject({ method: 'GET', url: '/me', headers: bearer(tokens.accessToken) });
    expect(me.statusCode).toBe(200);
  });

  it('rotates refresh tokens and revokes everything on reuse', async () => {
    const { tokens } = await registerParent(ctx.app);
    const first = await ctx.app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: tokens.refreshToken } });
    expect(first.statusCode).toBe(200);
    const rotated = first.json<AuthResponse>().tokens;
    expect(rotated.refreshToken).not.toBe(tokens.refreshToken);

    // Reusing the old token is treated as theft: it fails and kills the new one too.
    const reuse = await ctx.app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: tokens.refreshToken } });
    expect(reuse.statusCode).toBe(401);
    const afterReuse = await ctx.app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: rotated.refreshToken } });
    expect(afterReuse.statusCode).toBe(401);
  });

  it('logs out by revoking the refresh token', async () => {
    const { tokens } = await registerParent(ctx.app);
    const out = await ctx.app.inject({ method: 'POST', url: '/auth/logout', payload: { refreshToken: tokens.refreshToken } });
    expect(out.statusCode).toBe(204);
    const refresh = await ctx.app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: tokens.refreshToken } });
    expect(refresh.statusCode).toBe(401);
  });
});

describe('parent PIN', () => {
  it('sets, verifies and locks after repeated failures', async () => {
    const { tokens } = await registerParent(ctx.app);
    const h = bearer(tokens.accessToken);
    expect((await ctx.app.inject({ method: 'POST', url: '/me/pin', headers: h, payload: { pin: '4321' } })).statusCode).toBe(204);
    const me = await ctx.app.inject({ method: 'GET', url: '/me', headers: h });
    expect(me.json().hasPin).toBe(true);

    const ok = await ctx.app.inject({ method: 'POST', url: '/me/pin/verify', headers: h, payload: { pin: '4321' } });
    expect(ok.json()).toEqual({ ok: true });

    for (let i = 0; i < 4; i += 1) {
      const bad = await ctx.app.inject({ method: 'POST', url: '/me/pin/verify', headers: h, payload: { pin: '0000' } });
      expect(bad.statusCode).toBe(401);
      expect(bad.json().error.details.attemptsLeft).toBe(4 - i);
    }
    const fifth = await ctx.app.inject({ method: 'POST', url: '/me/pin/verify', headers: h, payload: { pin: '0000' } });
    expect(fifth.json().error.details.attemptsLeft).toBe(0);
    const locked = await ctx.app.inject({ method: 'POST', url: '/me/pin/verify', headers: h, payload: { pin: '4321' } });
    expect(locked.statusCode).toBe(423);
  });

  it('requires the account password to change an existing PIN', async () => {
    const { tokens } = await registerParent(ctx.app);
    const h = bearer(tokens.accessToken);
    await ctx.app.inject({ method: 'POST', url: '/me/pin', headers: h, payload: { pin: '1111' } });
    const noPw = await ctx.app.inject({ method: 'POST', url: '/me/pin', headers: h, payload: { pin: '2222' } });
    expect(noPw.statusCode).toBe(400);
    const withPw = await ctx.app.inject({
      method: 'POST',
      url: '/me/pin',
      headers: h,
      payload: { pin: '2222', currentPassword: 'Sunflower123' },
    });
    expect(withPw.statusCode).toBe(204);
  });
});

describe('account privacy', () => {
  it('exports and deletes the family account', async () => {
    const { tokens } = await registerParent(ctx.app);
    const h = bearer(tokens.accessToken);
    await ctx.app.inject({ method: 'POST', url: '/children', headers: h, payload: { name: 'Kai', age: 4, avatar: 'owl' } });
    const exported = await ctx.app.inject({ method: 'GET', url: '/me/export', headers: h });
    expect(exported.json().children).toHaveLength(1);

    const wrongPw = await ctx.app.inject({ method: 'DELETE', url: '/me', headers: h, payload: { password: 'wrong' } });
    expect(wrongPw.statusCode).toBe(401);
    const del = await ctx.app.inject({ method: 'DELETE', url: '/me', headers: h, payload: { password: 'Sunflower123' } });
    expect(del.statusCode).toBe(204);
    expect((await ctx.app.inject({ method: 'GET', url: '/me', headers: h })).statusCode).toBe(401);
  });
});

describe('password reset', () => {
  it('emails a one-time link, resets the password and signs out other devices', async () => {
    const { tokens } = await registerParent(ctx.app, { email: 'reset@test.local' });
    const unknown = await ctx.app.inject({ method: 'POST', url: '/auth/password/forgot', payload: { email: 'nobody@test.local' } });
    expect(unknown.statusCode).toBe(202);
    expect(mailer.sent).toHaveLength(0);

    const res = await ctx.app.inject({ method: 'POST', url: '/auth/password/forgot', payload: { email: 'reset@test.local' } });
    expect(res.statusCode).toBe(202);
    expect(mailer.sent).toHaveLength(1);
    const token = new URL(mailer.sent[0]!.link.replace('kidzo://', 'https://x/')).searchParams.get('token');
    expect(token).toBeTruthy();

    const weak = await ctx.app.inject({ method: 'POST', url: '/auth/password/reset', payload: { token, password: 'short' } });
    expect(weak.statusCode).toBe(400);
    const ok = await ctx.app.inject({ method: 'POST', url: '/auth/password/reset', payload: { token, password: 'NewSunflower456' } });
    expect(ok.statusCode).toBe(204);
    const reused = await ctx.app.inject({ method: 'POST', url: '/auth/password/reset', payload: { token, password: 'Another789xyz' } });
    expect(reused.statusCode).toBe(400);

    const oldRefresh = await ctx.app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: tokens.refreshToken } });
    expect(oldRefresh.statusCode).toBe(401);
    await expect(login(ctx.app, 'reset@test.local', 'NewSunflower456')).resolves.toBeTruthy();
  });
});
