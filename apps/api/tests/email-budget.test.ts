import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EmailBudget } from '../src/modules/auth/email-budget.js';

function budget(sent: { count: number }) {
  const logs: { level: string; message: string }[] = [];
  const logger = {
    warn: (_context: object, message: string) =>
      logs.push({ level: 'warn', message }),
    error: (_context: object, message: string) =>
      logs.push({ level: 'error', message }),
  };
  const repository = { sentSince: async () => sent.count };
  return {
    logs,
    budget: new EmailBudget(repository as never, 100, logger as never),
  };
}

test('below 80% everything is sent and nothing is logged', async () => {
  const { budget: b, logs } = budget({ count: 79 });
  assert.equal(await b.allows(false), true);
  assert.equal(logs.length, 0);
});

test('80% logs one warning a day and still sends', async () => {
  const sent = { count: 80 };
  const { budget: b, logs } = budget(sent);
  const day = new Date('2026-10-07T10:00:00Z');
  assert.equal(await b.allows(false, day), true);
  sent.count = 85;
  assert.equal(await b.allows(false, day), true);
  assert.deepEqual(
    logs.map((log) => log.level),
    ['warn'],
    'warned once',
  );
  // A new day can warn again.
  await b.allows(false, new Date('2026-10-08T10:00:00Z'));
  assert.equal(logs.length, 2);
});

test('90% refuses non-essential sends, keeps essential ones and logs once', async () => {
  const { budget: b, logs } = budget({ count: 90 });
  assert.equal(await b.allows(false), false);
  assert.equal(await b.allows(true), true);
  assert.equal(await b.allows(false), false);
  assert.deepEqual(
    logs.map((log) => log.level),
    ['error'],
  );
});
