// View models for live-session screens. They mirror the role-safe session
// snapshots in API_DESIGN §22–23 so realtime data can replace fixtures later.

export type LiveQuestionType =
  'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'DESCRIPTIVE';

export type LiveQuizSummary = {
  id: string;
  publicId: string;
  title: string;
  projectName: string;
  hostName: string;
  plannedDate: string;
  plannedTime: string;
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
