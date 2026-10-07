import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createDatabase } from '@quizmb/database';
import { ERROR_CODE, HTTP_HEADER } from '@quizmb/contracts';
import { createApp } from '../src/app.js';
import { MemoryMailbox } from '../src/infrastructure/email.js';
import { createLogger } from '../src/infrastructure/logger.js';
import { createRedis } from '../src/infrastructure/redis.js';
import { RateLimiter } from '../src/infrastructure/rate-limiter.js';
import { RATE_LIMITS } from '../src/config/rate-limits.js';
import { AuthRepository } from '../src/modules/auth/repository.js';
import { AuthService } from '../src/modules/auth/service.js';
import { parseAuthEnv } from '../src/modules/auth/config.js';
import { UsersService } from '../src/modules/users/service.js';

test(
  'REST rate limits: per client IP behind a proxy, per user, and window reset',
  { skip: !process.env.DATABASE_URL || !process.env.REDIS_URL },
  async (t) => {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Development integration tests only');
    const config = parseAuthEnv(process.env);
    const db = createDatabase(
      config.DATABASE_URL,
      config.DATABASE_SSL_CA_BASE64,
    );
    const mailbox = new MemoryMailbox();
    const redis = createRedis(process.env.REDIS_URL!);
    await redis.connect();
    const logger = createLogger('silent');
    const limiter = new RateLimiter(redis, logger);
    // Tiny limits under scopes unique to this run, so runs never interfere.
    const run = randomUUID();
    const rules = {
      ...RATE_LIMITS,
      signupIp: { scope: `test-signup-${run}`, limit: 1, windowSeconds: 60 },
      register: { scope: `test-register-${run}`, limit: 1, windowSeconds: 60 },
    };
    const origin = 'http://localhost:3000';
    const server = createApp({
      allowedOrigins: [origin],
      logger,
      auth: new AuthService(new AuthRepository(db), config, mailbox),
      users: new UsersService(db),
      database: db,
      rateLimiter: limiter,
      rateLimits: rules,
      trustProxyHops: 1,
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const emails: string[] = [];
    t.after(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.user.deleteMany({ where: { email: { in: emails } } });
      await db.$disconnect();
      await redis.quit();
    });

    const post = (
      path: string,
      body: unknown,
      { ip = '203.0.113.10', cookie = '' } = {},
    ) =>
      fetch(base + '/api' + path, {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          'X-Forwarded-For': ip,
          Cookie: cookie,
        },
        body: JSON.stringify(body),
      });
    const assertLimited = async (response: Response, label: string) => {
      assert.equal(response.status, 429, label);
      const body = (await response.json()) as { error: { code: string } };
      assert.equal(body.error.code, ERROR_CODE.RATE_LIMITED, label);
      const wait = Number(response.headers.get(HTTP_HEADER.RETRY_AFTER));
      assert.ok(wait >= 1 && wait <= 60, `${label}: Retry-After ${wait}`);
    };

    // Per client IP, read from the trusted proxy hop (X-Forwarded-For).
    const signup = (ip: string) => {
      const email = `rate-signup-${randomUUID()}@example.invalid`;
      emails.push(email);
      return post(
        '/auth/signup',
        { name: 'Rate Limit', email, password: 'a strong rate limit password' },
        { ip },
      );
    };
    const first = await signup('198.51.100.1');
    assert.equal(first.status, 201);
    await assertLimited(await signup('198.51.100.1'), 'second signup, same IP');
    assert.equal(
      (await signup('198.51.100.2')).status,
      201,
      'a different client IP has its own budget',
    );

    // Per signed-in user, counted before the route itself runs.
    // Signup does not sign in: verify the first account to get a session.
    const firstBody = (await first.json()) as {
      data: { verification: { ticket: string } };
    };
    const verified = await post('/auth/verify-email', {
      ticket: firstBody.data.verification.ticket,
      code: await mailbox.codeFor(emails[0]!),
    });
    assert.equal(verified.status, 200);
    const cookie = verified.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    const register = () =>
      post(`/quizzes/${randomUUID()}/register`, {}, { cookie });
    assert.equal((await register()).status, 404);
    await assertLimited(await register(), 'second registration request');

    // A new window starts over (real Redis, one-second window).
    const reset = { scope: `test-reset-${run}`, limit: 1, windowSeconds: 1 };
    const windowStart = Math.ceil(Date.now() / 1000) * 1000 + 50;
    await new Promise((resolve) =>
      setTimeout(resolve, windowStart - Date.now()),
    );
    assert.equal(await limiter.hit(reset, 'reset'), 0);
    assert.ok((await limiter.hit(reset, 'reset')) >= 1, 'over the limit');
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    assert.equal(await limiter.hit(reset, 'reset'), 0, 'reset next window');
  },
);
