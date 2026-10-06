// Single source of truth for wire-level string values shared by the API and
// the web app. Each group is an `as const` object plus a derived union type,
// so a typo is a compile error and a value changes in exactly one place.
// Values that mirror Prisma enums are checked against them in the API build.

type ValueOf<T> = T[keyof T];

export const QUIZ_STATUS = {
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  LOBBY: 'LOBBY',
  LIVE: 'LIVE',
  COMPLETED: 'COMPLETED',
} as const;
export type QuizStatus = ValueOf<typeof QUIZ_STATUS>;

/** Statuses a quiz can have once it is visible on its public page. */
export const PUBLIC_QUIZ_STATUSES = [
  QUIZ_STATUS.PUBLISHED,
  QUIZ_STATUS.LOBBY,
  QUIZ_STATUS.LIVE,
  QUIZ_STATUS.COMPLETED,
] as const;
export type PublicQuizStatus = (typeof PUBLIC_QUIZ_STATUSES)[number];

/** What an authoring change touches, which decides when it locks. */
export const EDIT_SCOPE = {
  /** Quiz details and cover: editable until the quiz goes live. */
  DETAILS: 'DETAILS',
  /** Questions and their images: fixed once the lobby opens. */
  QUESTIONS: 'QUESTIONS',
} as const;
export type EditScope = ValueOf<typeof EDIT_SCOPE>;

/** Quiz statuses in which each kind of change is refused. */
export const EDIT_LOCKED_STATUSES: Record<EditScope, readonly QuizStatus[]> = {
  [EDIT_SCOPE.DETAILS]: [QUIZ_STATUS.LIVE, QUIZ_STATUS.COMPLETED],
  [EDIT_SCOPE.QUESTIONS]: [
    QUIZ_STATUS.LOBBY,
    QUIZ_STATUS.LIVE,
    QUIZ_STATUS.COMPLETED,
  ],
};

export const isEditLocked = (status: QuizStatus, scope: EditScope) =>
  EDIT_LOCKED_STATUSES[scope].includes(status);

export const LIVE_SESSION_STATE = {
  LOBBY: 'LOBBY',
  LIVE_IDLE: 'LIVE_IDLE',
  QUESTION_ACTIVE: 'QUESTION_ACTIVE',
  QUESTION_RESULT: 'QUESTION_RESULT',
  LEADERBOARD: 'LEADERBOARD',
  COMPLETED: 'COMPLETED',
} as const;
export type LiveSessionState = ValueOf<typeof LIVE_SESSION_STATE>;
export const LIVE_SESSION_STATES = Object.values(LIVE_SESSION_STATE);

export const LIVE_ROLE = {
  HOST: 'HOST',
  PARTICIPANT: 'PARTICIPANT',
} as const;
export type LiveRole = ValueOf<typeof LIVE_ROLE>;

export const QUESTION_TYPE = {
  SINGLE_CHOICE: 'SINGLE_CHOICE',
  MULTIPLE_CHOICE: 'MULTIPLE_CHOICE',
  DESCRIPTIVE: 'DESCRIPTIVE',
} as const;
export type QuestionType = ValueOf<typeof QUESTION_TYPE>;

/** A participant's outcome for one asked question. */
export const ANSWER_STATUS = {
  SUBMITTED: 'SUBMITTED',
  NOT_ATTEMPTED: 'NOT_ATTEMPTED',
} as const;
export type AnswerStatus = ValueOf<typeof ANSWER_STATUS>;

/** Lifecycle of a question the host actually asked in a live session. */
export const ASKED_QUESTION_STATUS = {
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
} as const;
export type AskedQuestionStatus = ValueOf<typeof ASKED_QUESTION_STATUS>;

export const MEDIA_PURPOSE = {
  QUIZ_COVER: 'QUIZ_COVER',
  QUESTION_IMAGE: 'QUESTION_IMAGE',
} as const;
export type MediaPurpose = ValueOf<typeof MEDIA_PURPOSE>;

export const MEDIA_STATUS = {
  PENDING: 'PENDING',
  READY: 'READY',
  DELETED: 'DELETED',
} as const;
export type MediaStatus = ValueOf<typeof MEDIA_STATUS>;

export const REGISTRATION_STATUS = {
  REGISTERED: 'REGISTERED',
  CANCELLED: 'CANCELLED',
} as const;
export type RegistrationStatus = ValueOf<typeof REGISTRATION_STATUS>;

/** Machine-readable `error.code` values returned by REST and socket acks. */
export const ERROR_CODE = {
  // Generic
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  FORBIDDEN: 'FORBIDDEN',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  /** Temporarily overloaded; safe to retry after `Retry-After` seconds. */
  SERVICE_BUSY: 'SERVICE_BUSY',
  // Authentication
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  // Email verification and password reset (Phase 12)
  /** The code is wrong; `details.attemptsLeft` says how many tries remain. */
  INVALID_CODE: 'INVALID_CODE',
  /** The code expired, was replaced, was used, or ran out of attempts. */
  CODE_EXPIRED: 'CODE_EXPIRED',
  /** A new code was requested before the resend cooldown ended. */
  RESEND_COOLDOWN: 'RESEND_COOLDOWN',
  /** The verification or reset ticket expired; start the step again. */
  AUTH_FLOW_EXPIRED: 'AUTH_FLOW_EXPIRED',
  // Authoring and media
  QUIZ_LOCKED: 'QUIZ_LOCKED',
  INVALID_QUIZ_STATE: 'INVALID_QUIZ_STATE',
  INVALID_MEDIA: 'INVALID_MEDIA',
  MEDIA_IN_USE: 'MEDIA_IN_USE',
  UPLOAD_INCOMPLETE: 'UPLOAD_INCOMPLETE',
  STORAGE_UNAVAILABLE: 'STORAGE_UNAVAILABLE',
  // Registration
  ALREADY_REGISTERED: 'ALREADY_REGISTERED',
  NOT_REGISTERED: 'NOT_REGISTERED',
  HOST_CANNOT_REGISTER: 'HOST_CANNOT_REGISTER',
  QUIZ_FULL: 'QUIZ_FULL',
  REGISTRATION_CLOSED: 'REGISTRATION_CLOSED',
  UNREGISTRATION_CLOSED: 'UNREGISTRATION_CLOSED',
  REGISTRATION_REQUIRED: 'REGISTRATION_REQUIRED',
  // Live sessions
  ACTIVE_SESSION_EXISTS: 'ACTIVE_SESSION_EXISTS',
  SESSION_NOT_FOUND: 'SESSION_NOT_FOUND',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  QUIZ_NOT_OPEN: 'QUIZ_NOT_OPEN',
  QUIZ_COMPLETED: 'QUIZ_COMPLETED',
  LATE_JOIN_DISABLED: 'LATE_JOIN_DISABLED',
  NOT_JOINED: 'NOT_JOINED',
  SESSION_REPLACED: 'SESSION_REPLACED',
  LOBBY_CLOSED: 'LOBBY_CLOSED',
  LIVE_UNAVAILABLE: 'LIVE_UNAVAILABLE',
  OPERATION_IN_PROGRESS: 'OPERATION_IN_PROGRESS',
  // Live questions
  QUESTION_ALREADY_ASKED: 'QUESTION_ALREADY_ASKED',
  QUESTION_NOT_ACTIVE: 'QUESTION_NOT_ACTIVE',
  SUBMISSION_CLOSED: 'SUBMISSION_CLOSED',
  ALREADY_SUBMITTED: 'ALREADY_SUBMITTED',
  INVALID_ANSWER: 'INVALID_ANSWER',
} as const;
export type ErrorCode = ValueOf<typeof ERROR_CODE>;

export const HTTP_METHOD = {
  GET: 'GET',
  HEAD: 'HEAD',
  OPTIONS: 'OPTIONS',
  POST: 'POST',
  PUT: 'PUT',
  PATCH: 'PATCH',
  DELETE: 'DELETE',
} as const;
export type HttpMethod = ValueOf<typeof HTTP_METHOD>;

export const HTTP_HEADER = {
  ACCEPT: 'Accept',
  AUTHORIZATION: 'Authorization',
  CACHE_CONTROL: 'Cache-Control',
  CONTENT_TYPE: 'Content-Type',
  CONTENT_LENGTH: 'Content-Length',
  COOKIE: 'Cookie',
  ORIGIN: 'Origin',
  REQUEST_ID: 'X-Request-ID',
  RETRY_AFTER: 'Retry-After',
  TRANSFER_ENCODING: 'Transfer-Encoding',
  USER_AGENT: 'User-Agent',
} as const;

export const CONTENT_TYPE = { JSON: 'application/json' } as const;

const COOKIE_PREFIX = { secure: '__Secure-', host: '__Host-' } as const;
const AUTH_COOKIE_BASE = {
  access: 'quizmb-access',
  refresh: 'quizmb-refresh',
} as const;

/**
 * Auth cookie names. Production adds browser-enforced prefixes: the access
 * cookie is `__Secure-` (it may carry a Domain), the refresh cookie `__Host-`.
 */
export function authCookieNames(production: boolean) {
  return {
    access: (production ? COOKIE_PREFIX.secure : '') + AUTH_COOKIE_BASE.access,
    refresh: (production ? COOKIE_PREFIX.host : '') + AUTH_COOKIE_BASE.refresh,
  };
}

/** Quizzes that are published and not finished: open, in lobby, or live. */
export const ACTIVE_QUIZ_STATUSES: readonly QuizStatus[] = [
  QUIZ_STATUS.PUBLISHED,
  QUIZ_STATUS.LOBBY,
  QUIZ_STATUS.LIVE,
];
