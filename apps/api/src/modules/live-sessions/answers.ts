import {
  ERROR_CODE,
  QUESTION_TYPE,
  type QuestionType,
} from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';

type AnswerKey = {
  type: QuestionType;
  options: Array<{ id: string; isCorrect: boolean }>;
};

type SubmittedShape = {
  selectedOptionIds?: string[] | undefined;
  answerText?: string | undefined;
};

export type EvaluatedAnswer = {
  selectedOptionIds: string[];
  answerText: string | null;
  /** Null for descriptive questions, which have no correct answer. */
  isCorrect: boolean | null;
};

const invalid = (message: string) =>
  new ApiError(422, ERROR_CODE.INVALID_ANSWER, message);

/**
 * Checks an answer's shape against its question and decides correctness on
 * the server. Multiple answer is all-or-nothing: every correct option and
 * nothing else.
 */
export function evaluateAnswer(
  question: AnswerKey,
  answer: SubmittedShape,
): EvaluatedAnswer {
  if (question.type === QUESTION_TYPE.DESCRIPTIVE) {
    if (answer.selectedOptionIds || !answer.answerText)
      throw invalid('Type your answer before submitting.');
    return {
      selectedOptionIds: [],
      answerText: answer.answerText,
      isCorrect: null,
    };
  }
  const selected = answer.selectedOptionIds ?? [];
  if (answer.answerText !== undefined || selected.length === 0)
    throw invalid('Select an answer before submitting.');
  if (new Set(selected).size !== selected.length)
    throw invalid('Each option can be selected only once.');
  if (question.type === QUESTION_TYPE.SINGLE_CHOICE && selected.length !== 1)
    throw invalid('Select exactly one answer.');
  const known = new Set(question.options.map((option) => option.id));
  if (!selected.every((id) => known.has(id)))
    throw invalid('That answer does not belong to this question.');
  const correct = question.options
    .filter((option) => option.isCorrect)
    .map((option) => option.id);
  const isCorrect =
    selected.length === correct.length &&
    correct.every((id) => selected.includes(id));
  return { selectedOptionIds: selected, answerText: null, isCorrect };
}
