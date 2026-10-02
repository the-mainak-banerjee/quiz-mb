import type { LiveQuestionType } from './types';
import { QUESTION_TYPE } from '@quizmb/contracts';

export const questionTypeLabels: Record<LiveQuestionType, string> = {
  [QUESTION_TYPE.SINGLE_CHOICE]: 'Single Choice',
  [QUESTION_TYPE.MULTIPLE_CHOICE]: 'Multiple Answer',
  [QUESTION_TYPE.DESCRIPTIVE]: 'Descriptive',
};

export function questionNumber(position: number) {
  return `Q${String(position).padStart(2, '0')}`;
}

export function optionLetter(index: number) {
  return String.fromCharCode(65 + index);
}

export function percentOf(value: number, total: number) {
  return total > 0 ? Math.round((value / total) * 100) : 0;
}
