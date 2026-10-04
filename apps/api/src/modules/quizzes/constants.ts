import { QUIZ_STATUS, type QuizStatus } from '@quizmb/contracts';

/** What an authoring write changes, which decides when it locks. */
export const EDIT_SCOPE = {
  /** Quiz details and cover: editable until the quiz goes live. */
  DETAILS: 'DETAILS',
  /** Questions and their images: fixed once the lobby opens. */
  QUESTIONS: 'QUESTIONS',
} as const;
export type EditScope = (typeof EDIT_SCOPE)[keyof typeof EDIT_SCOPE];

export const LOCKED_STATUSES: Record<EditScope, readonly QuizStatus[]> = {
  [EDIT_SCOPE.DETAILS]: [QUIZ_STATUS.LIVE, QUIZ_STATUS.COMPLETED],
  [EDIT_SCOPE.QUESTIONS]: [
    QUIZ_STATUS.LOBBY,
    QUIZ_STATUS.LIVE,
    QUIZ_STATUS.COMPLETED,
  ],
};
