import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/infrastructure/rate-limiter.js';
import { ALERT } from '../src/infrastructure/alerts.js';
import {
  floodCounter,
  socketRateLimiter,
} from '../src/modules/live-sessions/socket-rate.js';
import {
  SOCKET_RATE_LIMITS,
  SOCKET_RATE_WINDOW_MS,
} from '../src/modules/live-sessions/constants.js';

type Redis = ConstructorParameters<typeof RateLimiter>[0];
const rule = { scope: 'test', limit: 2, windowSeconds: 60 };

test('socket budgets refuse commands over the limit until the window resets', () => {
  let now = 1_000;
  const withinBudget = socketRateLimiter(() => now);
  const key = 'session-a:user-1';
  for (let i = 0; i < SOCKET_RATE_LIMITS.answer; i++)
    assert.deepEqual(withinBudget(key, 'answer'), {
      allowed: true,
      firstRefusal: false,
    });
  assert.deepEqual(
    withinBudget(key, 'answer'),
    { allowed: false, firstRefusal: true },
    'the first refusal in a window is flagged (logged once)',
  );
  assert.deepEqual(withinBudget(key, 'answer'), {
    allowed: false,
    firstRefusal: false,
  });
  assert.equal(
    withinBudget(key, 'sync').allowed,
    true,
    'budgets are independent',
  );
  assert.equal(
    withinBudget('session-a:user-2', 'answer').allowed,
    true,
    'other accounts have their own budget',
  );
  now += SOCKET_RATE_WINDOW_MS;
  assert.equal(
    withinBudget(key, 'answer').allowed,
    true,
    'a new window starts',
  );
});

test('a reconnect shares the account budget (counters survive reconnects)', () => {
  const withinBudget = socketRateLimiter(() => 1_000);
  const key = 'session-a:user-1';
  // The same account and session, as from a new socket after reconnecting.
  for (let i = 0; i < SOCKET_RATE_LIMITS.answer; i++)
    withinBudget(key, 'answer');
  assert.equal(withinBudget(key, 'answer').allowed, false);
});

test('a connection is flagged once it keeps flooding', () => {
  let now = 1_000;
  const flooding = floodCounter(3, () => now);
  assert.equal(flooding(), false);
  assert.equal(flooding(), false);
  assert.equal(flooding(), true, 'the limit-th refusal closes it');
  now += SOCKET_RATE_WINDOW_MS;
  assert.equal(flooding(), false, 'a new window starts over');
});

test('Redis limiter counts per window, hides identifiers and reports the wait', async () => {
  const counts = new Map<string, number>();
  const redis = {
    eval: async (_script: string, _keys: number, key: string) => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts.get(key)!;
    },
  } as unknown as Redis;
  const warnings: { alert?: string; client?: string }[] = [];
  const limiter = new RateLimiter(redis, {
    warn: (context: object) => warnings.push(context),
  } as never);
  const now = 60_000 * 10 + 15_000; // 45 s before the window ends
  assert.equal(await limiter.hit(rule, 'person@example.com', now), 0);
  assert.equal(await limiter.hit(rule, 'person@example.com', now), 0);
  assert.equal(await limiter.hit(rule, 'person@example.com', now), 45);
  assert.equal(await limiter.hit(rule, 'other@example.com', now), 0);
  assert.equal(
    await limiter.hit(rule, 'person@example.com', now + 45_000),
    0,
    'the next window starts over',
  );
  // The first refusal in a window is one alert line, without the identifier.
  assert.equal(await limiter.hit(rule, 'person@example.com', now), 45);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0]!.alert, ALERT.RATE_LIMITED);
  assert.ok(!JSON.stringify(warnings).includes('example.com'));
  const keys = [...counts.keys()];
  assert.ok(keys.every((key) => key.startsWith('rate:test:')));
  assert.ok(
    keys.every((key) => !key.includes('example.com')),
    'identifiers are hashed',
  );
});

test('Redis limiter fails open and warns at most once a minute', async () => {
  const warnings: unknown[] = [];
  const redis = {
    eval: async () => {
      throw new Error('connection refused');
    },
  } as unknown as Redis;
  const limiter = new RateLimiter(redis, {
    warn: (...args: unknown[]) => warnings.push(args),
  });
  assert.equal(await limiter.hit(rule, 'a', 100_000), 0);
  assert.equal(await limiter.hit(rule, 'a', 100_500), 0);
  assert.equal(warnings.length, 1);
  assert.equal(await limiter.hit(rule, 'a', 200_000), 0);
  assert.equal(warnings.length, 2);
  assert.equal(
    await new RateLimiter(undefined, { warn: () => {} }).hit(rule, 'a'),
    0,
    'no Redis client: nothing is limited',
  );
});
