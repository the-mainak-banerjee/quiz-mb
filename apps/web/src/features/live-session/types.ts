import type { AnswerStatus, QuestionType } from '@quizmb/contracts';
// View models for live-session screens. They mirror the role-safe session
// snapshots in API_DESIGN §22–23 so realtime data can replace fixtures later.

export type LiveQuestionType = QuestionType;

export type LiveQuizSummary = {
  id: string;
  publicId: string;
  title: string;
  projectName: string;
  hostName: string;
  /** ISO timestamp, or null when not scheduled; formatted in the browser. */
  plannedStartAt: string | null;
  registrationLimit: number;
  questionCount: number;
  defaultDurationSeconds: number;
};

export type LiveParticipant = {
  id: string;
  name: string;
  connected: boolean;
  /** Preformatted join or registration detail. */
  detail: string;
  /** Present only while a question is active. */
  submitted?: boolean;
};

export type LiveOption = {
  id: string;
  text: string;
  /** Host-only; never part of participant payloads. */
  isCorrect: boolean;
};

export type QueueQuestionState =
  'available' | 'selected' | 'active' | 'asked' | 'locked';

export type QueueQuestion = {
  id: string;
  position: number;
  type: LiveQuestionType;
  text: string;
  durationSeconds: number;
  state: QueueQuestionState;
};

export type HostQuestion = QueueQuestion & { options: LiveOption[] };

export type OptionResult = LiveOption & { votes: number };

export type DescriptiveResponse = {
  id: string;
  number: number;
  text: string;
  receivedLabel: string;
};

export type LiveCounts = {
  connected: number;
  registered: number;
  asked: number;
};

// ---- Participant question flow (API_DESIGN §27 and §34) ----------------------

/** Participant-safe option: never carries correctness. */
export type ParticipantOption = { id: string; text: string };

/** The question as delivered to participants by `question:started`. */
export type ParticipantQuestion = {
  askedQuestionId: string;
  /** Order in which the host asked it (1-based), not its quiz position. */
  number: number;
  type: LiveQuestionType;
  text: string;
  imageUrl: string | null;
  options: ParticipantOption[];
  durationSeconds: number;
};

/** What the participant submitted; null text for choice questions. */
export type SubmittedAnswer = {
  selectedOptionIds: string[];
  answerText: string | null;
};

/** Revealed outcome after the timer ends; standing arrives separately. */
export type ParticipantQuestionResult = {
  status: AnswerStatus;
  selectedOptionIds: string[];
  answerText: string | null;
  correctOptionIds: string[];
  /** Null when not attempted or descriptive. */
  isCorrect: boolean | null;
  pointsAwarded: number;
  /** Final submissions per option id. */
  distribution: Record<string, number>;
};

export type ParticipantStanding = {
  totalScore: number;
  rank: number;
  participantCount: number;
};

/** Where one asked question is in its lifecycle for this participant. */
export type ParticipantQuestionPhase =
  | { kind: 'answering'; remainingSeconds: number }
  | { kind: 'submitted'; remainingSeconds: number; answer: SubmittedAnswer }
  /** Timer ended; the reveal has not arrived yet. */
  | { kind: 'closed'; answer: SubmittedAnswer | null }
  | {
      kind: 'revealed';
      result: ParticipantQuestionResult;
      /** Null while score and rank are being recalculated. */
      standing: ParticipantStanding | null;
    };
