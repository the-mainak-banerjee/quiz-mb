import {
  ANSWER_STATUS,
  type HostCurrentQuestionDto,
  type HostLiveQuestionDto,
  type HostLiveSnapshotDto,
  type LiveQuizInfoDto,
  type ParticipantAnswerDto,
  type ParticipantQuestionStateDto,
  type ParticipantStandingDto,
} from '@quizmb/contracts';
import type {
  DescriptiveResponse,
  HostQuestion,
  LiveParticipant,
  LiveQuizSummary,
  OptionResult,
  ParticipantQuestion,
  ParticipantQuestionPhase,
  QueueQuestion,
} from './types';

// Maps role-safe server snapshots to the presentational view models. Dates
// are formatted in the viewer's browser locale and time zone.

export function toQuizSummary(quiz: LiveQuizInfoDto): LiveQuizSummary {
  return {
    id: quiz.id,
    publicId: quiz.publicId,
    title: quiz.title,
    projectName: quiz.projectName,
    hostName: quiz.hostName,
    plannedStartAt: quiz.plannedStartAt,
    registrationLimit: quiz.registrationLimit,
    questionCount: quiz.questionCount,
    defaultDurationSeconds: quiz.defaultQuestionDurationSeconds,
  };
}

export function toRoster(snapshot: HostLiveSnapshotDto): LiveParticipant[] {
  return snapshot.roster.map((entry) => ({
    id: entry.userId,
    name: entry.name,
    connected: entry.connected,
    detail: entry.connected
      ? 'Connected now'
      : `Not connected yet · Registered ${new Date(
          entry.registeredAt,
        ).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`,
  }));
}

/**
 * Queue states: asked questions are done, the running one is live, and
 * nothing else can be chosen until it ends.
 */
export function toQueue(
  questions: HostLiveQuestionDto[],
  askedIds: ReadonlySet<string> = new Set(),
  activeId: string | null = null,
): QueueQuestion[] {
  return questions.map((question) => ({
    id: question.id,
    position: question.position,
    type: question.type,
    text: question.text,
    durationSeconds: question.durationSeconds,
    state:
      question.id === activeId
        ? 'active'
        : askedIds.has(question.id)
          ? 'asked'
          : activeId
            ? 'locked'
            : 'available',
  }));
}

/** Host answer breakdown: each option with its live submission count. */
export function toOptionResults(
  question: HostLiveQuestionDto,
  current: HostCurrentQuestionDto,
): OptionResult[] {
  return question.options.map((option) => ({
    ...option,
    votes: current.distribution[option.id] ?? 0,
  }));
}

function receivedLabel(submittedAt: string, now: number) {
  const seconds = Math.max(
    0,
    Math.round((now - Date.parse(submittedAt)) / 1000),
  );
  return seconds < 5 ? 'just now' : `${seconds}s ago`;
}

/** Newest-first anonymous responses, numbered in arrival order. */
export function toResponses(
  current: HostCurrentQuestionDto,
  now = Date.now(),
): DescriptiveResponse[] {
  return current.responses.map((response, index) => ({
    id: response.id,
    number: current.submittedCount - index,
    text: response.text,
    receivedLabel: receivedLabel(response.submittedAt, now),
  }));
}

export function toParticipantQuestion(
  question: ParticipantQuestionStateDto,
): ParticipantQuestion {
  return {
    askedQuestionId: question.askedQuestionId,
    number: question.number,
    type: question.type,
    text: question.text,
    imageUrl: question.imageUrl,
    options: question.options,
    durationSeconds: question.durationSeconds,
  };
}

/**
 * Where the question is for this participant. The reveal comes from the
 * server; until then the local countdown only decides what to display.
 */
export function toParticipantPhase(
  question: ParticipantQuestionStateDto,
  myAnswer: ParticipantAnswerDto | null,
  remainingSeconds: number,
  myStanding: ParticipantStandingDto | null = null,
): ParticipantQuestionPhase {
  const mine =
    myAnswer?.askedQuestionId === question.askedQuestionId ? myAnswer : null;
  if (question.reveal)
    return {
      kind: 'revealed',
      result: {
        status: mine?.status ?? ANSWER_STATUS.NOT_ATTEMPTED,
        selectedOptionIds: mine?.selectedOptionIds ?? [],
        answerText: mine?.answerText ?? null,
        correctOptionIds: question.reveal.correctOptionIds,
        isCorrect: mine?.isCorrect ?? null,
        pointsAwarded: mine?.pointsAwarded ?? 0,
        distribution: question.reveal.distribution,
      },
      // A standing from an earlier question means this one is still being
      // recalculated: the view shows its loading state meanwhile.
      standing:
        myStanding?.askedQuestionId === question.askedQuestionId
          ? {
              totalScore: myStanding.totalScore,
              rank: myStanding.rank,
              participantCount: myStanding.participantCount,
            }
          : null,
    };
  const answer =
    mine?.status === ANSWER_STATUS.SUBMITTED
      ? {
          selectedOptionIds: mine.selectedOptionIds,
          answerText: mine.answerText,
        }
      : null;
  if (remainingSeconds > 0)
    return answer
      ? { kind: 'submitted', remainingSeconds, answer }
      : { kind: 'answering', remainingSeconds };
  return { kind: 'closed', answer };
}

export function toHostQuestions(
  questions: HostLiveQuestionDto[],
): Record<string, HostQuestion> {
  return Object.fromEntries(
    questions.map((question) => [
      question.id,
      { ...toQueue([question])[0]!, options: question.options },
    ]),
  );
}
