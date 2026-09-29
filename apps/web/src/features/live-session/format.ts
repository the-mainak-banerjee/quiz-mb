import type { LiveQuestionType } from './types';

export const questionTypeLabels: Record<LiveQuestionType, string> = {
  SINGLE_CHOICE: 'Single Choice',
  MULTIPLE_CHOICE: 'Multiple Answer',
  DESCRIPTIVE: 'Descriptive',
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
