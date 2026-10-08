import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERROR_CODE } from '@quizmb/contracts';
import { parseEnv } from '../src/config/env.js';
import {
  PAUSABLE_FEATURE,
  requireActive,
} from '../src/config/feature-switch.js';
import { ApiError } from '../src/http/api-error.js';

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
      REDIS_URL: 'rediss://default:secret@example.upstash.io:6379',
      RESEND_API_KEY: 're_test',
      EMAIL_FROM: 'QuizMB <no-reply@quizmb.test>',
    }).ALLOWED_ORIGINS,
    ['https://app.quizmb.com'],
  );
});

test('production requires a Redis URL for live sessions', () => {
  assert.throws(
    () =>
      parseEnv({
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: 'https://app.quizmb.com',
      }),
    /REDIS_URL/,
  );
  assert.throws(
    () => parseEnv({ REDIS_URL: 'https://example.upstash.io' }),
    /REDIS_URL/,
  );
});

test('production requires email delivery for verification codes', () => {
  assert.throws(
    () =>
      parseEnv({
        NODE_ENV: 'production',
        ALLOWED_ORIGINS: 'https://app.quizmb.com',
        REDIS_URL: 'rediss://default:secret@example.upstash.io:6379',
      }),
    /RESEND_API_KEY and EMAIL_FROM/,
  );
});
test('the protective switch accepts known features only', () => {
  assert.equal(
    parseEnv({ PAUSED_FEATURES: 'signup, upload' }).PAUSED_FEATURES,
    'signup, upload',
  );
  assert.throws(
    () => parseEnv({ PAUSED_FEATURES: 'signup,uploads' }),
    /PAUSED_FEATURES/,
  );
});
test('paused features are refused with a clear message; others run', () => {
  const env = { PAUSED_FEATURES: 'quiz_create,UPLOAD' };
  for (const feature of [PAUSABLE_FEATURE.QUIZ_CREATE, PAUSABLE_FEATURE.UPLOAD])
    assert.throws(
      () => requireActive(feature, env),
      (error) =>
        error instanceof ApiError &&
        error.status === 503 &&
        error.code === ERROR_CODE.FEATURE_PAUSED &&
        /paused/.test(error.message),
    );
  assert.doesNotThrow(() => requireActive(PAUSABLE_FEATURE.SIGNUP, env));
  assert.doesNotThrow(() => requireActive(PAUSABLE_FEATURE.UPLOAD, {}));
});
