import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  questionSchema,
  quizSchema,
  uploadSchema,
  MEDIA_LIMITS,
} from '@quizmb/contracts';
import { isImage } from '../src/modules/media/storage.js';

const question = {
  type: 'SINGLE_CHOICE',
  text: '**Question**',
  imageMediaId: null,
  durationOverrideSeconds: null,
  options: [
    { text: 'Yes', isCorrect: true },
    { text: 'No', isCorrect: false },
  ],
};
test('question validation enforces type-specific answer keys and timer bounds', () => {
  assert.ok(questionSchema.safeParse(question).success);
  assert.equal(
    questionSchema.safeParse({
      ...question,
      options: question.options.map((o) => ({ ...o, isCorrect: true })),
    }).success,
    false,
  );
  assert.ok(
    questionSchema.safeParse({
      ...question,
      type: 'MULTIPLE_CHOICE',
      options: question.options.map((o) => ({ ...o, isCorrect: true })),
    }).success,
  );
  assert.equal(
    questionSchema.safeParse({
      ...question,
      type: 'MULTIPLE_CHOICE',
      options: question.options.map((o) => ({ ...o, isCorrect: false })),
    }).success,
    false,
  );
  assert.equal(
    questionSchema.safeParse({ ...question, type: 'DESCRIPTIVE' }).success,
    false,
  );
  assert.ok(
    questionSchema.safeParse({ ...question, type: 'DESCRIPTIVE', options: [] })
      .success,
  );
  assert.equal(
    questionSchema.safeParse({ ...question, durationOverrideSeconds: 0 })
      .success,
    false,
  );
});
test('quiz contract rejects lifecycle changes and project reassignment', () => {
  const input = {
    title: 'Quiz',
    description: '',
    registrationLimit: 10,
    defaultQuestionDurationSeconds: 30,
    allowLateJoin: false,
    coverMediaId: null,
    plannedStartAt: '2030-01-01T10:00:00Z',
  };
  assert.ok(quizSchema.safeParse(input).success);
  assert.equal(
    quizSchema.safeParse({ ...input, plannedStartAt: undefined }).success,
    false,
  );
  for (const extra of [
    { status: 'PUBLISHED' },
    { projectId: 'other' },
    { registrationLimit: 0 },
  ])
    assert.equal(quizSchema.safeParse({ ...input, ...extra }).success, false);
});
test('media rejects oversized/non-image files and detects mismatched signatures', () => {
  const upload = {
    purpose: 'QUIZ_COVER',
    fileName: 'cover.png',
    mimeType: 'image/png',
    sizeBytes: MEDIA_LIMITS.maxBytes,
    resource: { quizId: 'd9ad0af8-f040-425e-aaf6-856485244abe' },
  };
  assert.ok(uploadSchema.safeParse(upload).success);
  assert.equal(
    uploadSchema.safeParse({ ...upload, sizeBytes: MEDIA_LIMITS.maxBytes + 1 })
      .success,
    false,
  );
  assert.equal(
    uploadSchema.safeParse({ ...upload, mimeType: 'image/svg+xml' }).success,
    false,
  );
  assert.ok(
    isImage(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'),
  );
  assert.equal(isImage(Buffer.from('<script>'), 'image/png'), false);
});
