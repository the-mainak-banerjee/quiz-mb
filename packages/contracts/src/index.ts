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
export const AUTHORING_LIMITS = {
  projectName: 60,
  projectDescription: 240,
  quizTitle: 90,
  description: 4000,
  prompt: 10000,
  option: 1000,
  options: 20,
  questions: 200,
  duration: 3600,
  participants: 10000,
} as const;
/** Protective bound for a descriptive answer; not a product rule. */
export const ANSWER_LIMITS = { text: 2000 } as const;
export const MEDIA_LIMITS = {
  maxBytes: 10 * 1024 * 1024,
  mimeTypes: ['image/png', 'image/jpeg', 'image/webp'] as const,
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
export const uploadSchema = z
  .object({
    purpose: z.enum(MEDIA_PURPOSE),
    fileName: z.string().min(1).max(255),
    mimeType: z.enum(MEDIA_LIMITS.mimeTypes),
    sizeBytes: z.number().int().min(1).max(MEDIA_LIMITS.maxBytes),
    resource: z.object({ quizId: z.uuid() }).strict(),
  })
  .strict();
export type ProjectInput = z.infer<typeof projectSchema>;
export type QuizInput = z.infer<typeof quizSchema>;
export type QuestionInput = z.infer<typeof questionSchema>;
export type UploadInput = z.infer<typeof uploadSchema>;
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

type LiveSnapshotBase = {
  liveSessionId: string;
  /** Server clock when the snapshot was built; clients derive an offset. */
  serverTime: string;
  state: LiveSessionState;
  allowLateJoin: boolean;
  startedAt: string | null;
  endedAt: string | null;
  quiz: LiveQuizInfoDto;
  counts: { connected: number; registered: number };
};

export type HostLiveSnapshotDto = LiveSnapshotBase & {
  role: typeof LIVE_ROLE.HOST;
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

export type SocketAck<T> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };
