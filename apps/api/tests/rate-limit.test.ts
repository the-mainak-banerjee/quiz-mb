import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter } from '../src/infrastructure/rate-limiter.js';
import { socketRateLimiter } from '../src/modules/live-sessions/socket-rate.js';
import {
  SOCKET_RATE_LIMITS,
  SOCKET_RATE_WINDOW_MS,
} from '../src/modules/live-sessions/constants.js';

type Redis = ConstructorParameters<typeof RateLimiter>[0];
const rule = { scope: 'test', limit: 2, windowSeconds: 60 };

test('socket budgets refuse commands over the limit until the window resets', () => {
  let now = 1_000;
  const withinBudget = socketRateLimiter(() => now);
  for (let i = 0; i < SOCKET_RATE_LIMITS.answer; i++)
    assert.deepEqual(withinBudget('answer'), {
      allowed: true,
      firstRefusal: false,
    });
  assert.deepEqual(
    withinBudget('answer'),
    { allowed: false, firstRefusal: true },
    'the first refusal in a window is flagged (logged once)',
  );
  assert.deepEqual(withinBudget('answer'), {
    allowed: false,
    firstRefusal: false,
  });
  assert.equal(withinBudget('sync').allowed, true, 'budgets are independent');
  now += SOCKET_RATE_WINDOW_MS;
  assert.equal(withinBudget('answer').allowed, true, 'a new window starts');
});

test('Redis limiter counts per window, hides identifiers and reports the wait', async () => {
  const counts = new Map<string, number>();
  const redis = {
    eval: async (_script: string, _keys: number, key: string) => {
      counts.set(key, (counts.get(key) ?? 0) + 1);
      return counts.get(key)!;
    },
  } as unknown as Redis;
  const limiter = new RateLimiter(redis, { warn: () => {} });
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
