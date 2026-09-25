import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createDatabase } from '@quizmb/database';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/infrastructure/logger.js';
import { AuthRepository } from '../src/modules/auth/repository.js';
import { AuthService } from '../src/modules/auth/service.js';
import { UsersService } from '../src/modules/users/service.js';
import { parseAuthEnv } from '../src/modules/auth/config.js';
import { hashRefresh } from '../src/modules/auth/tokens.js';

test(
  'auth database and HTTP lifecycle, constraints, concurrency and revocation',
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    // Explicit integration command loads the local development env. All writes
    // belong to this unique fixture, and cleanup uses only its known IDs/email.
    if (process.env.NODE_ENV === 'production')
      throw new Error('Refusing auth integration tests in production');
    const config = parseAuthEnv(process.env);
    const db = createDatabase(
      config.DATABASE_URL,
      config.DATABASE_SSL_CA_BASE64,
    );
    const service = new AuthService(new AuthRepository(db), config);
    const origin = 'http://localhost:3000';
    const app = createApp({
      allowedOrigins: [origin],
      logger: createLogger('silent'),
      auth: service,
      users: new UsersService(db),
    });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    const email = 'auth-test-' + randomUUID() + '@example.invalid';
    const input = {
      name: 'Auth Test',
      email,
      password: 'a sufficiently long test password',
    };
    t.after(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.user.deleteMany({ where: { email } });
      await db.$disconnect();
    });
    const request = (
      path: string,
      method = 'GET',
      body?: unknown,
      cookie = '',
      requestOrigin = origin,
    ) =>
      fetch(base + path, {
        method,
        headers: {
          Origin: requestOrigin,
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const cookies = (response: Response) =>
      response.headers
        .getSetCookie()
        .map((v) => v.split(';')[0])
        .join('; ');
    const refreshValue = (cookie: string) =>
      cookie.match(/quizmb-refresh=([^;]+)/)![1]!;
    assert.equal((await request('/api/me')).status, 401);
    assert.equal(
      (
        await request(
          '/api/auth/signup',
          'POST',
          input,
          '',
          'https://evil.example',
        )
      ).status,
      403,
    );
    assert.equal(
      (await request('/api/auth/signup', 'POST', input, '', '')).status,
      403,
    );
    const signup = await request('/api/auth/signup', 'POST', {
      ...input,
      email: email.toUpperCase(),
    });
    assert.equal(signup.status, 201);
    const initial = cookies(signup);
    const signupBody = (await signup.json()) as {
      data: { user: { email: string } };
    };
    assert.equal(signupBody.data.user.email, email);
    assert.equal(JSON.stringify(signupBody).includes('password'), false);
    assert.equal(JSON.stringify(signupBody).includes('refresh'), false);
    for (const cookie of signup.headers.getSetCookie()) {
      assert.match(cookie, /HttpOnly/);
      assert.match(cookie, /SameSite=Lax/);
      assert.match(cookie, /Path=\//);
      assert.ok(!cookie.includes('Domain='));
    }
    const stored = await db.user.findUniqueOrThrow({
      where: { email },
      include: { sessions: true },
    });
    assert.match(stored.passwordHash, /^\$argon2id\$/);
    assert.equal(
      stored.sessions[0]!.refreshTokenHash,
      hashRefresh(refreshValue(initial)),
    );
    assert.notEqual(
      stored.sessions[0]!.refreshTokenHash,
      refreshValue(initial),
    );
    assert.equal(
      (await request('/api/auth/signup', 'POST', input)).status,
      409,
    );
    assert.equal(
      (await request('/api/me', 'GET', undefined, initial)).status,
      200,
    );
    const profile = await request(
      '/api/me',
      'PATCH',
      { name: 'Updated Name' },
      initial,
    );
    assert.equal(
      ((await profile.json()) as { data: { name: string } }).data.name,
      'Updated Name',
    );
    assert.equal(
      (
        await request(
          '/api/me',
          'PATCH',
          { email: 'unapproved@example.invalid' },
          initial,
        )
      ).status,
      422,
    );
    const wrong = await request('/api/auth/login', 'POST', {
      email,
      password: 'wrong password',
    });
    const absent = await request('/api/auth/login', 'POST', {
      email: 'absent-' + email,
      password: 'wrong password',
    });
    assert.equal(wrong.status, 401);
    assert.equal(absent.status, 401);
    assert.equal(
      ((await wrong.json()) as { error: { message: string } }).error.message,
      ((await absent.json()) as { error: { message: string } }).error.message,
    );
    const rotated = await request('/api/auth/refresh', 'POST', {}, initial);
    assert.equal(rotated.status, 200);
    const next = cookies(rotated);
    assert.notEqual(next, initial);
    assert.equal(
      (await request('/api/me', 'GET', undefined, next)).status,
      200,
    );
    assert.equal(
      (await request('/api/auth/refresh', 'POST', {}, initial)).status,
      401,
    );
    assert.equal(
      (await request('/api/me', 'GET', undefined, next)).status,
      401,
    );
    assert.equal(
      (await request('/api/auth/refresh', 'POST', {}, next)).status,
      401,
    );
    const login = () =>
      request('/api/auth/login', 'POST', { email, password: input.password });
    const active = cookies(await login());
    assert.equal(
      (await request('/api/auth/logout', 'POST', {}, active)).status,
      200,
    );
    assert.equal(
      (await request('/api/me', 'GET', undefined, active)).status,
      401,
    );
    assert.equal(
      (await request('/api/auth/refresh', 'POST', {}, active)).status,
      401,
    );
    const parallel = cookies(await login());
    const raced = await Promise.all([
      request('/api/auth/refresh', 'POST', {}, parallel),
      request('/api/auth/refresh', 'POST', {}, parallel),
    ]);
    assert.deepEqual(raced.map((r) => r.status).sort(), [200, 401]);
    const winner = cookies(raced.find((r) => r.status === 200)!);
    assert.equal(
      (await request('/api/me', 'GET', undefined, winner)).status,
      401,
    );
    const expiring = cookies(await login());
    await db.authSession.update({
      where: { refreshTokenHash: hashRefresh(refreshValue(expiring)) },
      data: { expiresAt: new Date(0) },
    });
    assert.equal(
      (await request('/api/auth/refresh', 'POST', {}, expiring)).status,
      401,
    );
    const competing = cookies(await login());
    const [refreshing, loggingOut] = await Promise.all([
      request('/api/auth/refresh', 'POST', {}, competing),
      request('/api/auth/logout', 'POST', {}, competing),
    ]);
    assert.equal(loggingOut.status, 200);
    if (refreshing.status === 200)
      assert.equal(
        (await request('/api/me', 'GET', undefined, cookies(refreshing)))
          .status,
        401,
      );
    else assert.equal(refreshing.status, 401);
    // Revoking one session family must not revoke an independent login.
    const one = cookies(await login()),
      two = cookies(await login());
    await request('/api/auth/logout', 'POST', {}, one);
    assert.equal((await request('/api/me', 'GET', undefined, two)).status, 200);
    const rls = await db.$queryRaw<
      Array<{ relname: string; relrowsecurity: boolean }>
    >`SELECT relname, relrowsecurity FROM pg_class WHERE oid IN ('public.users'::regclass, 'public.auth_sessions'::regclass)`;
    assert.equal(rls.length, 2);
    assert.ok(rls.every((row) => row.relrowsecurity));
  },
);
