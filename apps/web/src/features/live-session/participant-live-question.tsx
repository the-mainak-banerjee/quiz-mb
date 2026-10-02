'use client';

import { useEffect, useState } from 'react';
import {
  ERROR_CODE,
  QUESTION_TYPE,
  type ParticipantAnswerDto,
  type ParticipantQuestionStateDto,
  type ParticipantStandingDto,
  type SocketAck,
} from '@quizmb/contracts';
import { ParticipantQuestionView } from './participant-question';
import type { SubmittedAnswer } from './types';
import { useRemainingSeconds } from './use-countdown';
import { toParticipantPhase, toParticipantQuestion } from './view-models';

/** While the countdown shows zero, ask the server to close the question. */
const CLOSE_NUDGE_MS = 2_000;

/** Refusals that mean the server's view differs: fetch it instead. */
const RESYNC_ERRORS = new Set<string>([
  ERROR_CODE.ALREADY_SUBMITTED,
  ERROR_CODE.SUBMISSION_CLOSED,
  ERROR_CODE.QUESTION_NOT_ACTIVE,
]);

/** The participant's live question, driven by server snapshots. */
export function ParticipantLiveQuestion({
  question,
  myAnswer,
  myStanding,
  joinedDuringQuestion,
  clockOffsetMs,
  submitAnswer,
  resync,
}: {
  question: ParticipantQuestionStateDto;
  myAnswer: ParticipantAnswerDto | null;
  myStanding: ParticipantStandingDto | null;
  joinedDuringQuestion: boolean;
  clockOffsetMs: number;
  submitAnswer: (
    askedQuestionId: string,
    answer: { selectedOptionIds?: string[]; answerText?: string },
  ) => Promise<SocketAck<ParticipantAnswerDto>>;
  resync: () => Promise<void>;
}) {
  const remaining = useRemainingSeconds(question.endsAt, clockOffsetMs);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  const phase = toParticipantPhase(question, myAnswer, remaining, myStanding);

  // The server closes the question on its own timer; if the reveal is late
  // (e.g. the API restarted), a sync makes the server close it now.
  const waiting = phase.kind === 'closed';
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => void resync(), CLOSE_NUDGE_MS);
    return () => window.clearInterval(timer);
  }, [waiting, resync]);

  async function submit(answer: SubmittedAnswer) {
    setSubmitting(true);
    setError(undefined);
    const ack = await submitAnswer(
      question.askedQuestionId,
      question.type === QUESTION_TYPE.DESCRIPTIVE
        ? { answerText: answer.answerText ?? '' }
        : { selectedOptionIds: answer.selectedOptionIds },
    );
    setSubmitting(false);
    if (ack.ok) return;
    setError(ack.error.message);
    if (RESYNC_ERRORS.has(ack.error.code)) void resync();
  }

  return (
    <ParticipantQuestionView
      question={toParticipantQuestion(question)}
      phase={phase}
      lateJoin={joinedDuringQuestion}
      submitting={submitting}
      error={error}
      onSubmit={(answer) => void submit(answer)}
    />
  );
}
