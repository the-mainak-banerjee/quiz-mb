import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEnv } from '../src/config/env.js';

test('local defaults use ports and origin from the approved topology', () => {
  assert.equal(parseEnv({}).PORT, 4000);
  assert.deepEqual(parseEnv({}).ALLOWED_ORIGINS, ['http://localhost:3000']);
});
test('invalid ports and origins fail without printing input secrets', () => {
  assert.throws(() => parseEnv({ PORT: '0' }), /PORT/);
  assert.throws(() => parseEnv({ ALLOWED_ORIGINS: '*' }), /ALLOWED_ORIGINS/);
  assert.throws(
    () => parseEnv({ ALLOWED_ORIGINS: 'https://user:secret@example.com' }),
    (error) => error instanceof Error && !error.message.includes('secret'),
  );
});
test('production requires explicit origins', () => {
  assert.throws(
    () => parseEnv({ NODE_ENV: 'production' }),
    /explicitly configured/,
  );
  assert.deepEqual(
    parseEnv({
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://app.quizmb.com',
    }).ALLOWED_ORIGINS,
    ['https://app.quizmb.com'],
  );
});
