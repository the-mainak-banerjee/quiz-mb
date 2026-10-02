import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ERROR_CODE, QUESTION_TYPE } from '@quizmb/contracts';
import { evaluateAnswer } from '../src/modules/live-sessions/answers.js';
import { pointsFor } from '../src/modules/live-sessions/scoring.js';

const options = [
  { id: 'a', isCorrect: true },
  { id: 'b', isCorrect: false },
  { id: 'c', isCorrect: true },
];
const single = {
  type: QUESTION_TYPE.SINGLE_CHOICE,
  options: options.map((option) => ({
    ...option,
    isCorrect: option.id === 'a',
  })),
};
const multiple = { type: QUESTION_TYPE.MULTIPLE_CHOICE, options };
const descriptive = { type: QUESTION_TYPE.DESCRIPTIVE, options: [] };
const invalid = { code: ERROR_CODE.INVALID_ANSWER };

test('single choice is correct only for the correct option', () => {
  assert.equal(
    evaluateAnswer(single, { selectedOptionIds: ['a'] }).isCorrect,
    true,
  );
  assert.equal(
    evaluateAnswer(single, { selectedOptionIds: ['b'] }).isCorrect,
    false,
  );
  assert.throws(
    () => evaluateAnswer(single, { selectedOptionIds: ['a', 'b'] }),
    invalid,
  );
});

test('multiple answer is all-or-nothing', () => {
  assert.equal(
    evaluateAnswer(multiple, { selectedOptionIds: ['c', 'a'] }).isCorrect,
    true,
  );
  assert.equal(
    evaluateAnswer(multiple, { selectedOptionIds: ['a'] }).isCorrect,
    false,
    'partial answers earn nothing',
  );
  assert.equal(
    evaluateAnswer(multiple, { selectedOptionIds: ['a', 'b', 'c'] }).isCorrect,
    false,
    'an extra wrong option makes it incorrect',
  );
  assert.throws(
    () => evaluateAnswer(multiple, { selectedOptionIds: ['a', 'a'] }),
    invalid,
  );
});

test('answers must match the question shape and options', () => {
  assert.throws(
    () => evaluateAnswer(single, { selectedOptionIds: ['zzz'] }),
    invalid,
  );
  assert.throws(() => evaluateAnswer(single, { answerText: 'A' }), invalid);
  assert.throws(() => evaluateAnswer(single, {}), invalid);
  assert.throws(
    () => evaluateAnswer(descriptive, { selectedOptionIds: ['a'] }),
    invalid,
  );
  assert.throws(() => evaluateAnswer(descriptive, {}), invalid);
});

test('descriptive answers keep their text and have no correctness', () => {
  assert.deepEqual(evaluateAnswer(descriptive, { answerText: 'Because.' }), {
    selectedOptionIds: [],
    answerText: 'Because.',
    isCorrect: null,
  });
});

test('faster correct answers earn more; wrong or missing earn nothing', () => {
  const duration = 20_000;
  const instant = pointsFor(true, 0, duration);
  const quick = pointsFor(true, 1_600, duration);
  const halfway = pointsFor(true, 9_000, duration);
  const buzzer = pointsFor(true, 19_400, duration);
  assert.equal(instant, 1000);
  assert.ok(instant > quick && quick > halfway && halfway > buzzer);
  assert.equal(quick, 952);
  assert.equal(halfway, 730);
  assert.equal(buzzer, 418);
  assert.equal(pointsFor(true, duration, duration), 400);
  assert.equal(pointsFor(false, 0, duration), 0);
  assert.equal(pointsFor(null, 0, duration), 0, 'descriptive scores zero');
});
