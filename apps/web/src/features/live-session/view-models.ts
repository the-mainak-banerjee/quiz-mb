import type {
  HostLiveQuestionDto,
  HostLiveSnapshotDto,
  LiveQuizInfoDto,
} from '@quizmb/contracts';
import type {
  HostQuestion,
  LiveParticipant,
  LiveQuizSummary,
  QueueQuestion,
} from './types';

// Maps role-safe server snapshots to the presentational view models. Dates
// are formatted in the viewer's browser locale and time zone.

export function toQuizSummary(quiz: LiveQuizInfoDto): LiveQuizSummary {
  const planned = quiz.plannedStartAt ? new Date(quiz.plannedStartAt) : null;
  return {
    id: quiz.id,
    publicId: quiz.publicId,
    title: quiz.title,
    projectName: quiz.projectName,
    hostName: quiz.hostName,
    plannedDate: planned
      ? planned.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : 'Date to be announced',
    plannedTime: planned
      ? planned.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        })
      : '',
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

/** Phase 5 has no asked questions yet, so every question is available. */
export function toQueue(questions: HostLiveQuestionDto[]): QueueQuestion[] {
  return questions.map((question) => ({
    id: question.id,
    position: question.position,
    type: question.type,
    text: question.text,
    durationSeconds: question.durationSeconds,
    state: 'available',
  }));
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
