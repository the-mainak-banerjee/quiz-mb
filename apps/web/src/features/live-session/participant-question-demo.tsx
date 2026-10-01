'use client';

import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui';
import {
  previewResult,
  previewStanding,
  type ParticipantQuestionFixture,
} from './mock-data';
import { ParticipantQuestionView } from './participant-question';
import type { ParticipantQuestionPhase, SubmittedAnswer } from './types';

// Development preview only: a local clock stands in for the server's endsAt,
// and fixed delays stand in for the reveal and standing events.
const SUBMIT_DELAY_MS = 600;
const REVEAL_DELAY_MS = 1200;
const STANDING_DELAY_MS = 1800;

function Flow({ fixture }: { fixture: ParticipantQuestionFixture }) {
  const duration = fixture.question.durationSeconds;
  const [phase, setPhase] = useState<ParticipantQuestionPhase>({
    kind: 'answering',
    remainingSeconds: duration,
  });
  const [submitting, setSubmitting] = useState(false);

  const ticking = phase.kind === 'answering' || phase.kind === 'submitted';
  useEffect(() => {
    if (!ticking) return;
    const timer = setInterval(() => {
      setPhase((current) => {
        if (current.kind === 'answering' || current.kind === 'submitted') {
          if (current.remainingSeconds > 1) {
            return {
              ...current,
              remainingSeconds: current.remainingSeconds - 1,
            };
          }
          return {
            kind: 'closed',
            answer: current.kind === 'submitted' ? current.answer : null,
          };
        }
        return current;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [ticking]);

  useEffect(() => {
    if (phase.kind === 'closed') {
      const answer = phase.answer;
      const timer = setTimeout(() => {
        setSubmitting(false);
        setPhase({
          kind: 'revealed',
          result: previewResult(fixture, answer),
          standing: null,
        });
      }, REVEAL_DELAY_MS);
      return () => clearTimeout(timer);
    }
    if (phase.kind === 'revealed' && !phase.standing) {
      const result = phase.result;
      const timer = setTimeout(() => {
        setPhase({
          kind: 'revealed',
          result,
          standing: previewStanding(result),
        });
      }, STANDING_DELAY_MS);
      return () => clearTimeout(timer);
    }
  }, [phase, fixture]);

  function submit(answer: SubmittedAnswer) {
    setSubmitting(true);
    setTimeout(() => {
      setSubmitting(false);
      setPhase((current) =>
        current.kind === 'answering'
          ? {
              kind: 'submitted',
              remainingSeconds: current.remainingSeconds,
              answer,
            }
          : current,
      );
    }, SUBMIT_DELAY_MS);
  }

  return (
    <ParticipantQuestionView
      question={fixture.question}
      phase={phase}
      submitting={submitting}
      onSubmit={submit}
    />
  );
}

/** Plays one question end to end so the transitions can be reviewed. */
export function ParticipantQuestionDemo({
  fixture,
}: {
  fixture: ParticipantQuestionFixture;
}) {
  const [run, setRun] = useState(0);
  return (
    <>
      <Flow key={run} fixture={fixture} />
      <div className="fixed right-margin-sm bottom-margin-sm z-30">
        <Button
          variant="outline"
          icon={<RotateCcw size={16} aria-hidden="true" />}
          onClick={() => setRun((count) => count + 1)}
          className="shadow-raised"
        >
          Replay
        </Button>
      </div>
    </>
  );
}
