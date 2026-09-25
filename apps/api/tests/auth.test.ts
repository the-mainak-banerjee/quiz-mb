import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { SignJWT } from 'jose';
import { hashPassword, verifyPassword } from '../src/modules/auth/password.js';
import {
  signupSchema,
  validate,
  profileSchema,
} from '../src/modules/auth/validation.js';
import { Tokens, hashRefresh, newRefresh } from '../src/modules/auth/tokens.js';
import { parseAuthEnv } from '../src/modules/auth/config.js';
import express from 'express';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { authCookies } from '../src/modules/auth/cookies.js';

const config = parseAuthEnv({
  DATABASE_URL: 'postgresql://localhost/test',
  AUTH_ACCESS_SECRET: 'x'.repeat(43),
});
test('shared access and API-only refresh cookies are secure and cleared consistently', async (t) => {
  const app = express();
  const cookies = authCookies(true, 'quizmb.com');
  app.get('/set', (_req, res) => {
    cookies.set(res, {
      user: { id: randomUUID(), name: 'Test', email: 'test@example.invalid' },
      access: 'test-access',
      refresh: 'test-refresh',
      expiresAt: new Date(Date.now() + 3600000),
    });
    res.end();
  });
  app.get('/clear', (_req, res) => {
    cookies.clear(res);
    res.end();
  });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise<void>((resolve) => server.close(() => resolve())));
  await once(server, 'listening');
  const base = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
  for (const path of ['/set', '/clear']) {
    const response = await fetch(base + path);
    const values = response.headers.getSetCookie();
    assert.equal(values.length, 2);
    for (const value of values) {
      assert.match(value, /^__(?:Host|Secure)-quizmb-/);
      for (const flag of [
        /; Secure/i,
        /; HttpOnly/i,
        /; SameSite=Lax/i,
        /; Path=\//i,
      ])
        assert.match(value, flag);
      if (value.startsWith('__Secure-quizmb-access'))
        assert.match(value, /; Domain=quizmb.com/i);
      else assert.doesNotMatch(value, /; Domain=/i);
      if (path === '/clear') assert.match(value, /Expires=Thu, 01 Jan 1970/);
    }
  }
});
test('passwords use Argon2id; invalid and unknown-account passwords fail', async () => {
  const password = 'a long password with spaces';
  const hash = await hashPassword(password);
  assert.match(hash, /^\$argon2id\$/);
  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('incorrect', hash), false);
  assert.equal(await verifyPassword(password), false);
});
test('signup normalizes identity and enforces approved password bounds', () => {
  const input = {
    name: '  Test Person  ',
    email: ' PERSON@example.com ',
    password: 'correct horse battery staple',
  };
  assert.deepEqual(validate(signupSchema, input), {
    ...input,
    name: 'Test Person',
    email: 'person@example.com',
  });
  for (const password of ['short', 'x'.repeat(129)])
    assert.throws(() => validate(signupSchema, { ...input, password }));
  assert.doesNotThrow(() =>
    validate(signupSchema, { ...input, password: '猫'.repeat(15) }),
  );
  assert.throws(() => validate(signupSchema, { ...input, role: 'admin' }));
  assert.throws(() => validate(profileSchema, { email: 'other@example.com' }));
});
test('access tokens validate signature, audience and expiry; refresh hashes conceal credentials', async () => {
  const tokens = new Tokens(config);
  const userId = randomUUID(),
    sessionId = randomUUID();
  const signed = await tokens.issue(userId, sessionId);
  assert.deepEqual(await tokens.verify(signed), { userId, sessionId });
  await assert.rejects(tokens.verify(signed + 'tampered'));
  const expired = await new SignJWT({ sid: sessionId })
    .setSubject(userId)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuer('quizmb-api')
    .setAudience('quizmb')
    .setIssuedAt()
    .setExpirationTime(1)
    .sign(new TextEncoder().encode(config.AUTH_ACCESS_SECRET));
  await assert.rejects(tokens.verify(expired), { code: 'TOKEN_EXPIRED' });
  const refresh = newRefresh();
  assert.equal(refresh.length, 43);
  assert.notEqual(refresh, newRefresh());
  assert.match(hashRefresh(refresh), /^[a-f0-9]{64}$/);
  assert.equal(hashRefresh(refresh), hashRefresh(refresh));
});
test('auth environment validation does not leak supplied secrets', () => {
  assert.throws(
    () =>
      parseAuthEnv({
        ...config,
        NODE_ENV: 'production',
      } as unknown as NodeJS.ProcessEnv),
    /AUTH_COOKIE_DOMAIN/,
  );
  assert.throws(() => authCookies(true), /AUTH_COOKIE_DOMAIN/);
  assert.throws(
    () =>
      parseAuthEnv({
        DATABASE_URL: 'private-invalid-value',
        AUTH_ACCESS_SECRET: 'secret',
      }),
    (error) =>
      error instanceof Error &&
      !error.message.includes('private-invalid-value') &&
      !error.message.includes('secret'),
  );
});
