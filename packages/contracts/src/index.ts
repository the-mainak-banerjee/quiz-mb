import { z } from 'zod';
import {
  LIVE_ROLE,
  MEDIA_PURPOSE,
  QUESTION_TYPE,
  type LiveSessionState,
  type AnswerStatus,
  type LiveRole,
  type PublicQuizStatus,
  type QuestionType,
  type QuizStatus,
} from './constants.js';

export * from './constants.js';

// Central authoring limits: design text counters plus protective API bounds.
/** Password policy shared by signup and password reset. */
export const PASSWORD_LIMITS = { min: 15, max: 128 } as const;
const passwordLength = (value: string) => Array.from(value).length;
export const newPasswordSchema = z
  .string()
  .refine(
    (value) =>
      passwordLength(value) >= PASSWORD_LIMITS.min &&
      passwordLength(value) <= PASSWORD_LIMITS.max,
    `Use ${PASSWORD_LIMITS.min}–${PASSWORD_LIMITS.max} characters.`,
  );

/** One-time codes for email verification and password reset. */
export const OTP_PURPOSE = {
  EMAIL_VERIFICATION: 'EMAIL_VERIFICATION',
  PASSWORD_RESET: 'PASSWORD_RESET',
} as const;
export type OtpPurpose = (typeof OTP_PURPOSE)[keyof typeof OTP_PURPOSE];
export const OTP_RULES = {
  length: 6,
  ttlSeconds: 10 * 60,
  maxAttempts: 5,
  resendCooldownSeconds: 60,
  /** Codes entered from one network (verify email and reset code). */
  checksPerWindow: 15,
  checkWindowSeconds: 15 * 60,
  /** Reset codes one email address can be sent per hour. */
  resetRequestsPerHour: 5,
  /** Code emails one address can be sent, per purpose, including the first. */
  sendsPerHour: 5,
  sendsPerDay: 10,
  /**
   * Wrong codes per address and purpose in a rolling window. Survives
   * resends: a new code does not restore failed attempts.
   */
  failuresPerWindow: 10,
  failureWindowSeconds: 30 * 60,
} as const;
const otpCode = z
  .string()
  .regex(
    new RegExp(String.raw`^\d{${OTP_RULES.length}}$`),
    'Enter the 6-digit code.',
  );
const authEmail = z.string().trim().pipe(z.email().max(254));

/**
 * A pending email verification. The ticket identifies it (no session exists
 * until the code is accepted); the browser keeps it for this tab only.
 */
export type VerificationChallengeDto = {
  ticket: string;
  /** Masked for display, e.g. m***@example.com. */
  email: string;
  expiresAt: string;
  resendAvailableAt: string;
};

/** Signup and login either sign the user in or ask for email verification. */
export type AuthResultDto =
  | {
      status: 'AUTHENTICATED';
      user: { id: string; name: string; email: string };
    }
  | { status: 'VERIFICATION_REQUIRED'; verification: VerificationChallengeDto };
export const AUTH_RESULT_STATUS = {
  AUTHENTICATED: 'AUTHENTICATED',
  VERIFICATION_REQUIRED: 'VERIFICATION_REQUIRED',
} as const;

export const verifyEmailSchema = z
  .object({ ticket: z.string().min(1).max(512), code: otpCode })
  .strict();
export const resendVerificationSchema = z
  .object({ ticket: z.string().min(1).max(512) })
  .strict();
export const passwordResetRequestSchema = z
  .object({ email: authEmail })
  .strict();
export const passwordResetVerifySchema = z
  .object({ email: authEmail, code: otpCode })
  .strict();
export const passwordResetCompleteSchema = z
  .object({
    resetToken: z.string().min(1).max(512),
    password: newPasswordSchema,
  })
  .strict();
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type PasswordResetRequestInput = z.infer<
  typeof passwordResetRequestSchema
>;
export type PasswordResetVerifyInput = z.infer<
  typeof passwordResetVerifySchema
>;
export type PasswordResetCompleteInput = z.infer<
  typeof passwordResetCompleteSchema
>;

/**
 * The same answer whether or not the email has an account, so the response
 * never reveals which emails are registered.
 */
export type PasswordResetRequestDto = { resendAvailableAt: string };
/** Single-use proof that the reset code was correct. */
export type PasswordResetTokenDto = { resetToken: string; expiresAt: string };

export const AUTHORING_LIMITS = {
  projectName: 60,
  projectDescription: 240,
  quizTitle: 90,
  description: 4000,
  prompt: 10000,
  option: 1000,
  options: 20,
  /** Questions per quiz, checked under the quiz lock when adding. */
  questions: 25,
  duration: 3600,
  participants: 10000,
} as const;
/**
 * Plan-shaped limits. Before payments (security design Phase 1) every account
 * has this one fixed set; Phase 2 replaces it with a per-plan lookup.
 */
export const ACCOUNT_LIMITS = {
  /** Projects an account can own at once; deleting one frees a slot. */
  projects: 3,
  /** Quizzes created per rolling 24 hours; deleting one never gives it back. */
  quizCreationsPerDay: 100,
  /** Stored images (pending uploads included), across projects and quizzes. */
  mediaBytes: 5 * 1024 * 1024,
  /** Successful image uploads per rolling 24 hours. */
  uploadsPerDay: 50,
  /**
   * Live quizzes a host may start per calendar month (UTC). Opening a lobby
   * is free; ending early or deleting the quiz never gives a start back.
   */
  hostedSessionsPerMonth: 3,
} as const;
/** Protective bound for a descriptive answer; not a product rule. */
export const ANSWER_LIMITS = { text: 2000 } as const;
export const MEDIA_LIMITS = {
  /** A stored image: optimized in the browser to this size or less. */
  maxBytes: 250 * 1024,
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp'] as const,
  /** Longest side of a stored image; larger ones are scaled down. */
  maxDimension: 1600,
  /** What may be picked before optimization (guards against image bombs). */
  maxSelectedBytes: 20 * 1024 * 1024,
  maxSelectedPixels: 40_000_000,
};
export const projectSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, 'Enter a project name.')
      .max(AUTHORING_LIMITS.projectName),
    description: z.string().trim().max(AUTHORING_LIMITS.projectDescription),
  })
  .strict();
export const quizSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, 'Enter a quiz title.')
      .max(AUTHORING_LIMITS.quizTitle),
    description: z.string().trim().max(AUTHORING_LIMITS.description),
    registrationLimit: z
      .number()
      .int()
      .min(1)
      .max(AUTHORING_LIMITS.participants),
    defaultQuestionDurationSeconds: z
      .number()
      .int()
      .min(1)
      .max(AUTHORING_LIMITS.duration),
    allowLateJoin: z.boolean(),
    coverMediaId: z.uuid().nullable(),
    // Participant-facing metadata only. Saving a date never publishes or starts a quiz.
    plannedStartAt: z.iso.datetime({
      offset: true,
      error: 'Choose a planned date and time.',
    }),
  })
  .strict();
export const questionSchema = z
  .object({
    type: z.enum(QUESTION_TYPE),
    text: z
      .string()
      .trim()
      .min(1, 'Enter a question prompt.')
      .max(AUTHORING_LIMITS.prompt),
    imageMediaId: z.uuid().nullable(),
    durationOverrideSeconds: z
      .number()
      .int()
      .min(1)
      .max(AUTHORING_LIMITS.duration)
      .nullable(),
    options: z
      .array(
        z
          .object({
            text: z
              .string()
              .trim()
              .min(1, 'Enter an answer option.')
              .max(AUTHORING_LIMITS.option),
            isCorrect: z.boolean(),
          })
          .strict(),
      )
      .max(AUTHORING_LIMITS.options),
  })
  .strict()
  .superRefine((value, ctx) => {
    const correct = value.options.filter((o) => o.isCorrect).length;
    if (value.type === QUESTION_TYPE.DESCRIPTIVE) {
      if (value.options.length)
        ctx.addIssue({
          code: 'custom',
          path: ['options'],
          message: 'Descriptive questions have no answer options.',
        });
    } else {
      if (value.options.length < 2)
        ctx.addIssue({
          code: 'custom',
          path: ['options'],
          message: 'Add at least two options.',
        });
      if (
        (value.type === QUESTION_TYPE.SINGLE_CHOICE && correct !== 1) ||
        (value.type === QUESTION_TYPE.MULTIPLE_CHOICE && correct < 1)
      )
        ctx.addIssue({
          code: 'custom',
          path: ['options'],
          message:
            value.type === QUESTION_TYPE.SINGLE_CHOICE
              ? 'Choose exactly one correct answer.'
              : 'Choose at least one correct answer.',
        });
    }
  });
export const reorderSchema = z
  .object({ questionIds: z.array(z.uuid()).max(AUTHORING_LIMITS.questions) })
  .strict();
/** The image a browser is about to upload directly to storage. */
export const uploadFileSchema = z
  .object({
    fileName: z.string().min(1).max(255),
    mimeType: z.enum(MEDIA_LIMITS.mimeTypes),
    sizeBytes: z.number().int().min(1).max(MEDIA_LIMITS.maxBytes),
  })
  .strict();
export const uploadSchema = uploadFileSchema
  .extend({
    purpose: z.enum(MEDIA_PURPOSE),
    resource: z.object({ quizId: z.uuid() }).strict(),
  })
  .strict();
/**
 * Creating a quiz may also request its cover upload: the response carries
 * the upload ticket, and the cover is attached by a later quiz update.
 */
export const quizCreateSchema = quizSchema
  .extend({ cover: uploadFileSchema.optional() })
  .strict();
export type ProjectInput = z.infer<typeof projectSchema>;
export type QuizInput = z.infer<typeof quizSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type UploadInput = z.infer<typeof uploadSchema>;
export type UploadFileInput = z.infer<typeof uploadFileSchema>;
export type QuizCreateInput = z.infer<typeof quizCreateSchema>;
export type ProjectDto = ProjectInput & {
  id: string;
  createdAt: string;
  updatedAt: string;
  quizCount: number;
};
export type MediaDto = { id: string; url: string; fileName: string };
export type QuestionDto = QuestionInput & {
  id: string;
  position: number;
  image: MediaDto | null;
};
export type QuizDto = Omit<QuizInput, 'plannedStartAt'> & {
  id: string;
  projectId: string;
  projectName: string;
  publicId: string;
  plannedStartAt: string | null;
  status: QuizStatus;
  /** Confirmed registrations; the limit cannot go below this. */
  registrationCount: number;
  updatedAt: string;
  cover: MediaDto | null;
  questions: QuestionDto[];
};
export type QuizSummaryDto = {
  id: string;
  projectId: string;
  title: string;
  status: QuizStatus;
  updatedAt: string;
  questionCount: number;
};
export type UploadDto = {
  mediaId: string;
  upload: { url: string; token: string; path: string };
};
/**
 * `coverUpload` is null when no cover was requested or it was refused;
 * `coverRefusal` then says why when it is the user's limit (e.g. storage
 * full), so the quiz page can show it.
 */
export type QuizCreatedDto = QuizDto & {
  coverUpload: UploadDto | null;
  coverRefusal: string | null;
};

export type PublicQuizDto = {
  id: string;
  publicId: string;
  title: string;
  description: string;
  status: PublicQuizStatus;
  plannedStartAt: string;
  registrationLimit: number;
  registrationCount: number;
  isFull: boolean;
  project: { id: string; name: string };
  host: { id: string; name: string };
  cover: MediaDto | null;
  questionCount: number;
};

export type RegistrationDto = {
  registered: boolean;
  registeredAt: string | null;
  registrationCount: number;
  /** The ended live session of a quiz the user registered for (their result). */
  completedLiveSessionId: string | null;
};

export type HostRegistrationDto = {
  id: string;
  userId: string;
  name: string;
  registeredAt: string;
};

/**
 * A participant's final result. Counts cover scored (single-choice and
 * multiple-answer) questions that were actually asked; descriptive
 * questions are not counted.
 */
export type ParticipantFinalResultDto = {
  totalScore: number;
  rank: number;
  /** Everyone who entered the live session. */
  participantCount: number;
  correctCount: number;
  incorrectCount: number;
  notAttemptedCount: number;
};

/** One completed quiz the participant took part in. */
/**
 * One completed quiz the participant was registered for. `result` is null
 * when they never entered the live room.
 */
export type ParticipantHistoryDto = {
  liveSessionId: string;
  quiz: PublicQuizDto;
  completedAt: string | null;
  result: ParticipantFinalResultDto | null;
};

export type ParticipantDashboardDto = {
  upcoming: PublicQuizDto[];
  live: PublicQuizDto[];
  /** Completed quizzes with the participant's final result, newest first. */
  history: ParticipantHistoryDto[];
};

/** Totals for a completed live session. */
export type FinalSummaryDto = {
  participantCount: number;
  askedQuestionCount: number;
  /** Every question in the quiz, asked or not. */
  quizQuestionCount: number;
  /** Asked single-choice and multiple-answer questions. */
  scoredQuestionCount: number;
  /** Mean final score across participants (rounded). */
  averageScore: number;
  completedAt: string | null;
};

/** Completed quiz summary for one participant (`result` null if absent). */
export type ParticipantQuizResultDto = {
  liveSessionId: string;
  quiz: {
    id: string;
    publicId: string;
    title: string;
    projectName: string;
    hostName: string;
  };
  /** When the host started the quiz; null if it ended from the lobby. */
  startedAt: string | null;
  completedAt: string | null;
  result: ParticipantFinalResultDto | null;
};

/** Rows on the host results page; results pages hold this many. */
export const RESULTS_PAGE_SIZE = 100;

export type HostResultEntryDto = {
  rank: number;
  userId: string;
  name: string;
  score: number;
  correctCount: number;
  incorrectCount: number;
  notAttemptedCount: number;
};

export type HostQuizResultsDto = {
  liveSessionId: string;
  quiz: { id: string; publicId: string; title: string; projectName: string };
  summary: FinalSummaryDto;
  /** Ranked participants for this page (ties ordered by name). */
  entries: HostResultEntryDto[];
  /** Offset of the next page, or null when this is the last one. */
  nextOffset: number | null;
};

export type HostDashboardQuizDto = {
  id: string;
  publicId: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string;
  status: QuizStatus;
  plannedStartAt: string | null;
  updatedAt: string;
  questionCount: number;
  registrationCount: number;
};

export type HostDashboardDto = {
  projects: Array<{
    id: string;
    title: string;
    quizzes: number;
    members: number;
  }>;
  quizzes: HostDashboardQuizDto[];
};

// ---------------------------------------------------------------------------
// Live sessions (Phase 5). Socket.IO namespace, events, payloads and
// role-safe snapshots. Host and participant snapshots are separate types so
// host-only data (answer keys, roster) can never be sent to participants.

export const LIVE_SOCKET_NAMESPACE = '/quiz';
/** Read-only quiz lifecycle updates for the public quiz page. */
export const QUIZ_STATUS_NAMESPACE = '/quiz-status';
export const QUIZ_STATUS_EVENT = 'quiz:status';

export const LIVE_EVENTS = {
  join: 'session:join',
  sync: 'session:sync',
  leave: 'session:leave',
  quizStart: 'host:quiz-start',
  lateJoinSet: 'host:late-join-set',
  quizEnd: 'host:quiz-end',
  /** Host cancels an unstarted lobby; the quiz returns to PUBLISHED. */
  lobbyClose: 'host:lobby-close',
  snapshot: 'session:snapshot',
  replaced: 'session:replaced',
  /** The server removed this participant (e.g. they unregistered). */
  removed: 'session:removed',
  presence: 'host:presence-updated',
  /** Throttled connected count for participant screens. */
  count: 'session:connected-count',
  /** Host asks a question; it starts immediately for everyone. */
  questionStart: 'host:question-start',
  /** Participant submits the answer for the active question. */
  answerSubmit: 'answer:submit',
  /** Host-only, throttled: submissions for the active question. */
  submissions: 'host:submissions-updated',
  /** One participant's recalculated score and rank after a question ends. */
  standing: 'participant:standing',
  /** Host-only: the Top 10 without changing what participants see. */
  leaderboardGet: 'host:leaderboard-get',
  /** Host shows the Top 10 on every participant screen. */
  leaderboardShow: 'host:leaderboard-show',
  /** Host returns participants to the latest question result. */
  leaderboardHide: 'host:leaderboard-hide',
  /** Personal: this participant's final result once the quiz ends. */
  quizEnded: 'quiz:ended',
  /** Host reveals the final Top 10 on every participant screen. */
  finalLeaderboardShow: 'host:final-leaderboard-show',
  /** Participants: the host lost connection or came back (after a grace). */
  hostPresence: 'session:host-presence',
} as const;

/** Most rows a leaderboard lists; tied scores share a rank. */
export const LEADERBOARD_SIZE = 10;

export const liveSessionCommandSchema = z
  .object({ liveSessionId: z.uuid() })
  .strict();
export const lateJoinCommandSchema = z
  .object({ liveSessionId: z.uuid(), allow: z.boolean() })
  .strict();
export const questionStartCommandSchema = z
  .object({ liveSessionId: z.uuid(), questionId: z.uuid() })
  .strict();
/** Choice questions send option ids; descriptive questions send text. */
export const answerSubmitCommandSchema = z
  .object({
    liveSessionId: z.uuid(),
    askedQuestionId: z.uuid(),
    selectedOptionIds: z
      .array(z.uuid())
      .min(1)
      .max(AUTHORING_LIMITS.options)
      .optional(),
    answerText: z.string().trim().min(1).max(ANSWER_LIMITS.text).optional(),
  })
  .strict();
export type LiveSessionCommand = z.infer<typeof liveSessionCommandSchema>;
export type QuestionStartCommand = z.infer<typeof questionStartCommandSchema>;
export type AnswerSubmitCommand = z.infer<typeof answerSubmitCommandSchema>;
export type LateJoinCommand = z.infer<typeof lateJoinCommandSchema>;

export type LiveSessionRefDto = {
  id: string;
  quizId: string;
  state: LiveSessionState;
  role: LiveRole;
};

export type ActiveHostSessionDto = {
  id: string;
  quizId: string;
  quizTitle: string;
  projectName: string;
  state: LiveSessionState;
  createdAt: string;
  startedAt: string | null;
  connected: number;
  registered: number;
  questionCount: number;
};

export type SocketTicketDto = { ticket: string; expiresAt: string };

export type QuizStatusDto = {
  quizId: string;
  status: PublicQuizStatus;
};

export type LiveQuizInfoDto = {
  id: string;
  publicId: string;
  title: string;
  projectName: string;
  hostName: string;
  plannedStartAt: string | null;
  registrationLimit: number;
  questionCount: number;
  defaultQuestionDurationSeconds: number;
};

export type LiveRosterEntryDto = {
  userId: string;
  name: string;
  connected: boolean;
  registeredAt: string;
};

export type HostLiveQuestionDto = {
  id: string;
  position: number;
  type: QuestionType;
  text: string;
  durationSeconds: number;
  options: Array<{ id: string; text: string; isCorrect: boolean }>;
};

/** Participant-safe question: never carries correctness. */
export type LiveQuestionDto = {
  askedQuestionId: string;
  /** Order in which the host asked it (1-based). */
  number: number;
  type: QuestionType;
  text: string;
  imageUrl: string | null;
  options: Array<{ id: string; text: string }>;
  durationSeconds: number;
  startedAt: string;
  endsAt: string;
};

/** Shared once the question has ended; identical for every participant. */
export type LiveQuestionRevealDto = {
  correctOptionIds: string[];
  /** Final submissions per option id. */
  distribution: Record<string, number>;
  submittedCount: number;
};

export type ParticipantQuestionStateDto = LiveQuestionDto & {
  /** Null while the question is active. */
  reveal: LiveQuestionRevealDto | null;
};

/** One participant's own answer; correctness appears only after it ends. */
export type ParticipantAnswerDto = {
  askedQuestionId: string;
  status: AnswerStatus;
  selectedOptionIds: string[];
  answerText: string | null;
  isCorrect: boolean | null;
  pointsAwarded: number;
};

export type LeaderboardEntryDto = {
  rank: number;
  userId: string;
  name: string;
  score: number;
  /** Final leaderboard only: correct scored answers. */
  correctCount?: number;
};

/**
 * Top standings: at most LEADERBOARD_SIZE participants who have scored,
 * ties ordered by name. `rank` is the participant's overall rank.
 */
export type LeaderboardDto = {
  entries: LeaderboardEntryDto[];
  /** Everyone who entered the live session. */
  participantCount: number;
  /** Live number of the latest completed question, if any. */
  afterQuestionNumber: number | null;
};

/** Score and rank after the given asked question; ties share a rank. */
export type ParticipantStandingDto = {
  askedQuestionId: string;
  totalScore: number;
  rank: number;
  /** Everyone who entered the live session, including zero scores. */
  participantCount: number;
};

export type HostQuestionProgressDto = {
  askedQuestionId: string;
  submittedCount: number;
  distribution: Record<string, number>;
  /** Newest descriptive responses first, without participant identity. */
  responses: Array<{ id: string; text: string; submittedAt: string }>;
};

export type HostCurrentQuestionDto = HostQuestionProgressDto & {
  questionId: string;
  number: number;
  durationSeconds: number;
  startedAt: string;
  endsAt: string;
  ended: boolean;
};

/**
 * Server-enforced live-session deadlines (security design 1.6): an
 * unstarted lobby expires, a started quiz ends after the host has been
 * disconnected for the grace period, and every live quiz has a maximum
 * length with a final warning before it.
 */
export const LIVE_SESSION_LIMITS = {
  lobbyMinutes: 30,
  hostGraceMinutes: 15,
  maxMinutes: 4 * 60,
  /** The warning shows this long before the maximum is reached. */
  warningMinutes: 30,
} as const;

/** The host's monthly hosted-session allowance (shown before starting). */
export type HostingAllowanceDto = {
  used: number;
  limit: number;
  /** When the allowance resets: the first day of next month (UTC). */
  resetsAt: string;
};

type LiveSnapshotBase = {
  liveSessionId: string;
  /** Server clock when the snapshot was built; clients derive an offset. */
  serverTime: string;
  state: LiveSessionState;
  allowLateJoin: boolean;
  startedAt: string | null;
  endedAt: string | null;
  /** While in the lobby: when it expires unless the quiz starts. */
  lobbyExpiresAt: string | null;
  /** Once started: when the quiz ends automatically (maximum length). */
  sessionEndsAt: string | null;
  quiz: LiveQuizInfoDto;
  counts: { connected: number; registered: number };
};

export type HostLiveSnapshotDto = LiveSnapshotBase & {
  role: typeof LIVE_ROLE.HOST;
  /** In the lobby: how many starts the host has left this month. */
  hostingAllowance: HostingAllowanceDto | null;
  /** First registrations by time; `counts.registered` is the full total. */
  roster: LiveRosterEntryDto[];
  questions: HostLiveQuestionDto[];
  /** Questions asked so far, in live order. */
  askedQuestions: Array<{
    askedQuestionId: string;
    questionId: string;
    number: number;
  }>;
  /** The active question, or the one that just ended (QUESTION_RESULT). */
  currentQuestion: HostCurrentQuestionDto | null;
  /** Present while the leaderboard is shown to participants. */
  leaderboard: LeaderboardDto | null;
  /** After the quiz ends: totals and the final Top 10 (COMPLETED). */
  final: {
    summary: FinalSummaryDto;
    leaderboard: LeaderboardDto;
    /** Whether participants can see the final leaderboard. */
    leaderboardShown: boolean;
  } | null;
};

export type ParticipantLiveSnapshotDto = LiveSnapshotBase & {
  role: typeof LIVE_ROLE.PARTICIPANT;
  /** The active question, or the one that just ended (QUESTION_RESULT). */
  question: ParticipantQuestionStateDto | null;
  /** Present while the host shows the leaderboard (LEADERBOARD). */
  leaderboard: LeaderboardDto | null;
  /**
   * False once the host has been disconnected for longer than a short grace
   * period. The quiz keeps running; only the host can move it on.
   */
  hostConnected: boolean;
  /**
   * Personal fields: present only when the snapshot is addressed to one
   * participant (join, sync, question end). Absent means unchanged.
   */
  myAnswer?: ParticipantAnswerDto | null;
  /** True when this participant first joined after the question started. */
  joinedDuringQuestion?: boolean;
  /** Present once the current question has ended (personal snapshots). */
  myStanding?: ParticipantStandingDto | null;
};

export type LiveSnapshotDto = HostLiveSnapshotDto | ParticipantLiveSnapshotDto;

export type LivePresenceDto = {
  userId: string;
  connected: boolean;
  connectedCount: number;
};

export type LiveReplacedDto = { reason: string };

export type LiveRemovedDto = { code: string; message: string };

export type LiveCountDto = { connectedCount: number };

/** Sent to participants when the host's connection changes. */
export type LiveHostPresenceDto = { hostConnected: boolean };

export type SocketAck<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
