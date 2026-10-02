import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  ACTIVE_QUIZ_STATUSES,
  ERROR_CODE,
  LIVE_EVENTS,
  LIVE_ROLE,
  LIVE_SESSION_STATE,
  MEDIA_PURPOSE,
  MEDIA_STATUS,
  PUBLIC_QUIZ_STATUSES,
  QUESTION_TYPE,
  QUIZ_STATUS,
  REGISTRATION_STATUS,
  authCookieNames,
} from '@quizmb/contracts';

// Tests elsewhere assert raw literals on purpose. These pin the wire values
// so renaming a constant's value can never pass unnoticed.
test('status, role and type constants keep their wire values', () => {
  assert.deepEqual(Object.values(QUIZ_STATUS), [
    'DRAFT',
    'PUBLISHED',
    'LOBBY',
    'LIVE',
    'COMPLETED',
  ]);
  assert.deepEqual(Object.values(LIVE_SESSION_STATE), [
    'LOBBY',
    'LIVE_IDLE',
    'QUESTION_ACTIVE',
    'QUESTION_RESULT',
    'LEADERBOARD',
    'COMPLETED',
  ]);
  assert.deepEqual(Object.values(LIVE_ROLE), ['HOST', 'PARTICIPANT']);
  assert.deepEqual(Object.values(QUESTION_TYPE), [
    'SINGLE_CHOICE',
    'MULTIPLE_CHOICE',
    'DESCRIPTIVE',
  ]);
  assert.deepEqual(Object.values(MEDIA_PURPOSE), [
    'QUIZ_COVER',
    'QUESTION_IMAGE',
  ]);
  assert.deepEqual(Object.values(MEDIA_STATUS), [
    'PENDING',
    'READY',
    'DELETED',
  ]);
  assert.deepEqual(Object.values(REGISTRATION_STATUS), [
    'REGISTERED',
    'CANCELLED',
  ]);
  assert.deepEqual(PUBLIC_QUIZ_STATUSES, [
    'PUBLISHED',
    'LOBBY',
    'LIVE',
    'COMPLETED',
  ]);
  assert.deepEqual(ACTIVE_QUIZ_STATUSES, ['PUBLISHED', 'LOBBY', 'LIVE']);
});

test('every error code equals its key', () => {
  for (const [key, value] of Object.entries(ERROR_CODE))
    assert.equal(value, key);
});

test('socket event names and auth cookie names are stable', () => {
  assert.equal(LIVE_EVENTS.quizStart, 'host:quiz-start');
  assert.deepEqual(authCookieNames(false), {
    access: 'quizmb-access',
    refresh: 'quizmb-refresh',
  });
  assert.deepEqual(authCookieNames(true), {
    access: '__Secure-quizmb-access',
    refresh: '__Host-quizmb-refresh',
  });
});
