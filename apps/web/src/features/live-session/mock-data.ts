import type {
  DescriptiveResponse,
  HostQuestion,
  LiveParticipant,
  LiveQuestionType,
  LiveQuizSummary,
  OptionResult,
  ParticipantQuestion,
  ParticipantQuestionResult,
  ParticipantStanding,
  QueueQuestion,
  QueueQuestionState,
} from './types';
import {
  ANSWER_STATUS,
  QUESTION_TYPE,
  QUIZ_STATUS,
  type FinalSummaryDto,
  type HostQuizResultsDto,
  type LeaderboardDto,
  type ParticipantFinalResultDto,
  type ParticipantHistoryDto,
  type ParticipantQuizResultDto,
  type PublicQuizDto,
} from '@quizmb/contracts';

// Development preview fixtures only; never used by product routes.

export const liveQuiz: LiveQuizSummary = {
  id: '00000000-0000-4000-8000-000000000001',
  publicId: 'token-sync-2026',
  title: 'Design Systems & Token Architecture Sync',
  projectName: 'Product Design Community',
  hostName: 'Elena Rostova',
  plannedStartAt: '2026-10-25T00:00:00.000Z',
  registrationLimit: 50,
  questionCount: 16,
  defaultDurationSeconds: 20,
};

export const previewParticipantName = 'Mainak Banerjee';

const names = [
  'Sophia Lin',
  'Marcus Vance',
  'Aidan Chen',
  'Amara Rhee',
  'Julian Lewis',
  'Priya Desai',
  'Liam Torres',
  'Siddharth Rao',
  'Maya Hart',
  'Chloe Vidal',
  'Niko Berg',
  'Elena Stone',
  'Devon Miles',
  'Zoe Park',
  'Marcus Jones',
  'Freja Nilsson',
  'Kiran Gupta',
  'Tariq Wells',
  'Oliver Kent',
  'Lucas Ford',
  'Beatriz Xavier',
  'Hugo Tan',
  'Nina Young',
  'James Owen',
  'Hannah Quinn',
  'Rahul Menon',
  'Ines Carvalho',
  'Tom Becker',
  'Yuki Sato',
  'Grace Adeyemi',
  'Owen Price',
];

const joinTimes = ['6:48', '6:51', '6:52', '6:53', '6:55', '6:58'];

/** Connected participants in join order; the first 24 have submitted. */
export const connectedParticipants: LiveParticipant[] = names.map(
  (name, index) => ({
    id: `participant-${index + 1}`,
    name,
    connected: true,
    detail: `Joined ${joinTimes[index % joinTimes.length]} PM EST`,
    submitted: index < 24,
  }),
);

export const lobbyRoster: LiveParticipant[] = [
  ...connectedParticipants.slice(0, 5),
  {
    id: 'offline-1',
    name: 'David Thorne',
    connected: false,
    detail: 'Not connected yet · Registered Oct 22',
  },
  {
    id: 'offline-2',
    name: 'Nadia Kassem',
    connected: false,
    detail: 'Not connected yet · Registered Oct 23',
  },
  connectedParticipants[5]!,
];

export const liveCounts = { connected: 31, registered: 42 };

const bank: Array<{
  type: LiveQuestionType;
  text: string;
  durationSeconds: number;
}> = [
  {
    type: QUESTION_TYPE.SINGLE_CHOICE,
    text: 'What does semantic scope mean in design tokens?',
    durationSeconds: 20,
  },
  {
    type: QUESTION_TYPE.MULTIPLE_CHOICE,
    text: 'Select all valid token tier layers',
    durationSeconds: 30,
  },
  {
    type: QUESTION_TYPE.DESCRIPTIVE,
    text: 'Explain how component tokens inherit aliases',
    durationSeconds: 60,
  },
  {
    type: QUESTION_TYPE.SINGLE_CHOICE,
    text: 'Which contrast ratio satisfies WCAG 2.2 AA for large text?',
    durationSeconds: 15,
  },
  {
    type: QUESTION_TYPE.SINGLE_CHOICE,
    text: 'Identify the primary source of token drift',
    durationSeconds: 25,
  },
  {
    type: QUESTION_TYPE.DESCRIPTIVE,
    text: 'Explain how semantic tokens help maintain a scalable multi-brand design system.',
    durationSeconds: 60,
  },
  {
    type: QUESTION_TYPE.MULTIPLE_CHOICE,
    text: 'Select all valid dark mode luminance mapping strategies',
    durationSeconds: 30,
  },
  {
    type: QUESTION_TYPE.SINGLE_CHOICE,
    text: 'Where should a component token resolve its default value?',
    durationSeconds: 20,
  },
  {
    type: QUESTION_TYPE.SINGLE_CHOICE,
    text: 'Which layer owns brand colour decisions?',
    durationSeconds: 20,
  },
  {
    type: QUESTION_TYPE.DESCRIPTIVE,
    text: 'Describe one risk of skipping the semantic token layer',
    durationSeconds: 45,
  },
  {
    type: QUESTION_TYPE.MULTIPLE_CHOICE,
    text: 'Select the properties that belong in a spacing scale',
    durationSeconds: 30,
  },
  {
    type: QUESTION_TYPE.SINGLE_CHOICE,
    text: 'What triggers a token rebuild in a typical pipeline?',
    durationSeconds: 20,
  },
  {
    type: QUESTION_TYPE.SINGLE_CHOICE,
    text: 'Which naming pattern keeps tokens platform neutral?',
    durationSeconds: 20,
  },
  {
    type: QUESTION_TYPE.MULTIPLE_CHOICE,
    text: 'Select every valid elevation token consumer',
    durationSeconds: 25,
  },
  {
    type: QUESTION_TYPE.DESCRIPTIVE,
    text: 'How would you migrate a legacy palette to semantic tokens?',
    durationSeconds: 60,
  },
  {
    type: QUESTION_TYPE.SINGLE_CHOICE,
    text: 'Which token type should a focus ring reference?',
    durationSeconds: 20,
  },
];

function queue(
  states: Record<number, QueueQuestionState>,
  fallback: QueueQuestionState,
) {
  return bank.map<QueueQuestion>((question, index) => ({
    ...question,
    id: `question-${index + 1}`,
    position: index + 1,
    state: states[index + 1] ?? fallback,
  }));
}

/** LIVE_IDLE: Q1 selected, four questions already asked. */
export const idleQueue = queue(
  { 1: 'selected', 2: 'asked', 5: 'asked', 8: 'asked', 9: 'asked' },
  'available',
);

/** QUESTION_ACTIVE (scored): Q1 live, Q2–Q5 asked, everything else locked. */
export const scoredQueue = queue(
  { 1: 'active', 2: 'asked', 3: 'asked', 4: 'asked', 5: 'asked' },
  'locked',
);

/** QUESTION_ACTIVE (descriptive): Q6 live, Q1–Q5 asked. */
export const descriptiveQueue = queue(
  { 1: 'asked', 2: 'asked', 3: 'asked', 4: 'asked', 5: 'asked', 6: 'active' },
  'locked',
);

const semanticScopeOptions = [
  {
    id: 'option-a',
    text: 'The runtime memory footprint allocated for CSS variable caching',
    isCorrect: false,
    votes: 3,
  },
  {
    id: 'option-b',
    text: 'The contextual boundary restricting a token to specific component roles or design tiers',
    isCorrect: true,
    votes: 15,
  },
  {
    id: 'option-c',
    text: 'The Figma variable collection inheritance rule between library files',
    isCorrect: false,
    votes: 4,
  },
  {
    id: 'option-d',
    text: 'The global brand fallback value when component tokens fail to resolve',
    isCorrect: false,
    votes: 2,
  },
];

const genericOptions = (questionId: string, multiple: boolean) =>
  ['Primitive tokens', 'Semantic tokens', 'Component tokens', 'Raw values'].map(
    (text, index) => ({
      id: `${questionId}-option-${index + 1}`,
      text,
      isCorrect: index === 1 || (multiple && index === 2),
    }),
  );

/** Host-only content for every idle queue question, keyed by id. */
export const hostQuestions: Record<string, HostQuestion> = Object.fromEntries(
  idleQueue.map((question, index) => [
    question.id,
    {
      ...question,
      options:
        index === 0
          ? semanticScopeOptions.map(({ id, text, isCorrect }) => ({
              id,
              text,
              isCorrect,
            }))
          : question.type === QUESTION_TYPE.DESCRIPTIVE
            ? []
            : genericOptions(
                question.id,
                question.type === QUESTION_TYPE.MULTIPLE_CHOICE,
              ),
    },
  ]),
);

export const scoredQuestion = {
  question: scoredQueue[0]!,
  results: semanticScopeOptions satisfies OptionResult[],
  submitted: 24,
  remainingSeconds: 9,
};

export const descriptiveQuestion = {
  question: descriptiveQueue[5]!,
  submitted: 18,
  remainingSeconds: 39,
  responses: [
    {
      id: 'response-18',
      number: 18,
      receivedLabel: 'just now',
      text: 'Semantic tokens separate the visual intent (e.g. action-primary-bg) from the raw value. When creating a sub-brand or dark mode, you remap only the semantic alias layer rather than refactoring hundreds of components.',
    },
    {
      id: 'response-17',
      number: 17,
      receivedLabel: '8s ago',
      text: 'They create an abstraction boundary between design tools and codebases. Engineers subscribe to semantic variables, so value changes propagate without breaking production CSS.',
    },
    {
      id: 'response-16',
      number: 16,
      receivedLabel: '15s ago',
      text: 'A component can depend on a semantic role rather than a fixed value. If brand colours shift from forest to cobalt, the button component code stays identical.',
    },
    {
      id: 'response-15',
      number: 15,
      receivedLabel: '22s ago',
      text: 'Semantic scopes enforce accessible contrast and token discipline at the system level instead of relying on designers picking arbitrary values.',
    },
    {
      id: 'response-14',
      number: 14,
      receivedLabel: '31s ago',
      text: 'The core component library stays uniform across product suites while only the brand semantic map is swapped at build time.',
    },
  ] satisfies DescriptiveResponse[],
};

// ---- Participant question flow -------------------------------------------------

/** A participant-safe question plus the host-side answer key for previews. */
export type ParticipantQuestionFixture = {
  question: ParticipantQuestion;
  correctOptionIds: string[];
  /** Final submissions per option id. */
  distribution: Record<string, number>;
};

const participantSafe = (options: { id: string; text: string }[]) =>
  options.map(({ id, text }) => ({ id, text }));

export const participantQuestions = {
  single: {
    question: {
      askedQuestionId: 'asked-3',
      number: 3,
      type: QUESTION_TYPE.SINGLE_CHOICE,
      text: 'What does **semantic scope** mean in design tokens?',
      imageUrl: null,
      options: participantSafe(semanticScopeOptions),
      durationSeconds: 20,
    },
    correctOptionIds: ['option-b'],
    distribution: {
      'option-a': 60,
      'option-b': 320,
      'option-c': 105,
      'option-d': 15,
    },
  },
  multiple: {
    question: {
      askedQuestionId: 'asked-4',
      number: 4,
      type: QUESTION_TYPE.MULTIPLE_CHOICE,
      text: 'Which of these are tiers in a modern design token architecture?',
      imageUrl: null,
      options: [
        { id: 'tier-a', text: 'Global / primitive tokens' },
        { id: 'tier-b', text: 'Semantic / alias tokens' },
        { id: 'tier-c', text: 'Runtime compiler overrides' },
        { id: 'tier-d', text: 'Component / scoped tokens' },
      ],
      durationSeconds: 30,
    },
    correctOptionIds: ['tier-a', 'tier-b', 'tier-d'],
    distribution: {
      'tier-a': 410,
      'tier-b': 455,
      'tier-c': 120,
      'tier-d': 290,
    },
  },
  descriptive: {
    question: {
      askedQuestionId: 'asked-6',
      number: 6,
      type: QUESTION_TYPE.DESCRIPTIVE,
      text: 'Explain how semantic tokens help maintain a scalable multi-brand design system.',
      imageUrl: null,
      options: [],
      durationSeconds: 60,
    },
    correctOptionIds: [],
    distribution: {},
  },
} satisfies Record<string, ParticipantQuestionFixture>;

export const previewDescriptiveAnswer =
  'Components reference semantic roles such as action-primary instead of raw values, so each brand or theme only remaps the alias layer.';

/** Score and rank before the previewed question was revealed. */
export const previousStanding: ParticipantStanding = {
  totalScore: 3240,
  rank: 12,
  participantCount: 500,
};

const PREVIEW_POINTS = 820;

/** Outcome the server would reveal for a fixture and a submitted answer. */
export function previewResult(
  fixture: ParticipantQuestionFixture,
  answer: { selectedOptionIds: string[]; answerText: string | null } | null,
): ParticipantQuestionResult {
  const descriptive = fixture.question.type === QUESTION_TYPE.DESCRIPTIVE;
  const base = {
    correctOptionIds: fixture.correctOptionIds,
    distribution: fixture.distribution,
  };
  if (!answer) {
    return {
      ...base,
      status: ANSWER_STATUS.NOT_ATTEMPTED,
      selectedOptionIds: [],
      answerText: null,
      isCorrect: null,
      pointsAwarded: 0,
    };
  }
  const chosen = [...answer.selectedOptionIds].sort();
  const correct = [...fixture.correctOptionIds].sort();
  // All-or-nothing: every correct option and nothing else.
  const isCorrect = descriptive
    ? null
    : chosen.length === correct.length &&
      chosen.every((id, index) => id === correct[index]);
  return {
    ...base,
    status: ANSWER_STATUS.SUBMITTED,
    selectedOptionIds: answer.selectedOptionIds,
    answerText: answer.answerText,
    isCorrect,
    pointsAwarded: isCorrect ? PREVIEW_POINTS : 0,
  };
}

/** Recalculated standing after a revealed result (fixture values). */
export function previewStanding(
  result: ParticipantQuestionResult,
): ParticipantStanding {
  const descriptive =
    result.isCorrect === null && result.status === ANSWER_STATUS.SUBMITTED;
  if (descriptive) return previousStanding;
  return {
    ...previousStanding,
    totalScore: previousStanding.totalScore + result.pointsAwarded,
    rank: result.pointsAwarded > 0 ? 9 : 18,
  };
}

// ---- Leaderboard ----------------------------------------------------------------

const leaderboardScores: Array<[string, number]> = [
  ['Sophia Lin', 4890],
  ['Marcus Vance', 4750],
  ['Aidan Chen', 4620],
  ['Amara Rhee', 4410],
  ['Julian Lewis', 4410],
  ['Priya Desai', 4250],
  ['Liam Torres', 4190],
  [previewParticipantName, 4120],
  ['Maya Hart', 4060],
  ['Chloe Vidal', 3980],
];

/** Top 10 after question 3, with a tie at 4th place. */
export const previewLeaderboard: LeaderboardDto = {
  entries: leaderboardScores.map(([name, score], index) => ({
    rank: index === 4 ? 4 : index + 1,
    userId: `user-${index + 1}`,
    name,
    score,
  })),
  participantCount: 500,
  afterQuestionNumber: 3,
};

/** The previewed participant: user-8 is inside the top 10. */
export const previewParticipantId = 'user-8';

// ---- Final results (Phase 10) ------------------------------------------------

export const previewFinalSummary: FinalSummaryDto = {
  participantCount: 500,
  askedQuestionCount: 12,
  quizQuestionCount: 16,
  scoredQuestionCount: 12,
  averageScore: 5420,
  completedAt: '2026-10-24T19:42:00.000Z',
};

/** Final Top 10 with correct counts out of 12 scored questions. */
export const previewFinalBoard: LeaderboardDto = {
  ...previewLeaderboard,
  afterQuestionNumber: 12,
  entries: previewLeaderboard.entries.map((entry, index) => ({
    ...entry,
    score: entry.score + 3500,
    correctCount: 12 - Math.floor(index / 2),
  })),
};

export const previewFinalResult: ParticipantFinalResultDto = {
  totalScore: 8420,
  rank: 18,
  participantCount: 500,
  correctCount: 8,
  incorrectCount: 3,
  notAttemptedCount: 1,
};

const previewPublicQuiz = (
  title: string,
  projectName: string,
): PublicQuizDto => ({
  id: `quiz-${title.length}`,
  publicId: `public-${title.length}`,
  title,
  description: '',
  status: QUIZ_STATUS.COMPLETED,
  plannedStartAt: '2026-10-24T19:00:00.000Z',
  registrationLimit: 500,
  registrationCount: 420,
  isFull: false,
  questionCount: 16,
  cover: null,
  project: { id: 'project-1', name: projectName },
  host: { id: 'host-1', name: liveQuiz.hostName },
});

export const previewHistory: ParticipantHistoryDto[] = [
  {
    liveSessionId: 'session-1',
    quiz: previewPublicQuiz(liveQuiz.title, liveQuiz.projectName),
    completedAt: '2026-10-24T19:42:00.000Z',
    result: previewFinalResult,
  },
  {
    liveSessionId: 'session-2',
    quiz: previewPublicQuiz(
      'Quarterly Product Milestone Sync',
      'Company All-Hands',
    ),
    completedAt: '2026-10-12T17:30:00.000Z',
    result: {
      totalScore: 4120,
      rank: 4,
      participantCount: 86,
      correctCount: 11,
      incorrectCount: 1,
      notAttemptedCount: 0,
    },
  },
  {
    liveSessionId: 'session-3',
    quiz: previewPublicQuiz(
      'Distributed Systems Live Sprint',
      'Core Infrastructure',
    ),
    completedAt: '2026-09-29T16:10:00.000Z',
    result: null,
  },
];

export const previewParticipantResult: ParticipantQuizResultDto = {
  liveSessionId: 'session-1',
  quiz: {
    id: liveQuiz.id,
    publicId: liveQuiz.publicId,
    title: liveQuiz.title,
    projectName: liveQuiz.projectName,
    hostName: liveQuiz.hostName,
  },
  startedAt: '2026-10-24T19:04:00.000Z',
  completedAt: '2026-10-24T19:42:00.000Z',
  result: previewFinalResult,
};

export const previewHostResults: HostQuizResultsDto = {
  liveSessionId: 'session-1',
  quiz: {
    id: liveQuiz.id,
    publicId: liveQuiz.publicId,
    title: liveQuiz.title,
    projectName: liveQuiz.projectName,
  },
  summary: previewFinalSummary,
  entries: previewFinalBoard.entries.map((entry, index) => ({
    rank: entry.rank,
    userId: entry.userId,
    name: entry.name,
    score: entry.score,
    correctCount: entry.correctCount ?? 0,
    incorrectCount: Math.min(index % 3, 12 - (entry.correctCount ?? 0)),
    notAttemptedCount:
      12 -
      (entry.correctCount ?? 0) -
      Math.min(index % 3, 12 - (entry.correctCount ?? 0)),
  })),
  nextOffset: null,
};
