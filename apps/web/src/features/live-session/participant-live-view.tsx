'use client';

import { RefreshCw } from 'lucide-react';
import {
  ERROR_CODE,
  LIVE_SESSION_STATE,
  type LiveQuizInfoDto,
} from '@quizmb/contracts';
import { Button } from '@/components/ui';
import { NavigationItem } from '@/components/workspace/navigation-item';
import {
  LiveNotice,
  ParticipantLiveIdle,
  ParticipantLobby,
  ParticipantReconnecting,
} from './participant-screens';
import { MAX_RECONNECT_ATTEMPTS, useLiveSession } from './use-live-session';
import { toQuizSummary } from './view-models';

const refusals: Record<string, { eyebrow: string; title: string }> = {
  [ERROR_CODE.LATE_JOIN_DISABLED]: {
    eyebrow: 'Joining closed',
    title: 'The host is not admitting new participants',
  },
  [ERROR_CODE.REGISTRATION_REQUIRED]: {
    eyebrow: 'Registration required',
    title: 'Register for this quiz to join',
  },
  [ERROR_CODE.QUIZ_COMPLETED]: {
    eyebrow: 'Quiz ended',
    title: 'This live quiz has ended',
  },
  [ERROR_CODE.LOBBY_CLOSED]: {
    eyebrow: 'Lobby closed',
    title: 'The host closed the lobby',
  },
  [ERROR_CODE.SESSION_NOT_FOUND]: {
    eyebrow: 'Not live',
    title: 'This quiz is not live right now',
  },
};

/** Refusals that are an expected end state, not a fault. */
const NEUTRAL_REFUSALS = new Set<string>([
  ERROR_CODE.QUIZ_COMPLETED,
  ERROR_CODE.LOBBY_CLOSED,
]);

/** Participant live experience driven by the authoritative snapshot. */
export function ParticipantLiveView({
  liveSessionId,
  quiz: initialQuiz,
  participantName,
  quizHref,
}: {
  liveSessionId: string;
  /** Server-loaded quiz details for screens shown before the first snapshot. */
  quiz: LiveQuizInfoDto;
  participantName: string;
  quizHref: string;
}) {
  const { snapshot, connection, failure, attempt, reconnect } =
    useLiveSession(liveSessionId);
  const quiz = toQuizSummary(snapshot?.quiz ?? initialQuiz);
  const backToQuiz = (
    <NavigationItem href={quizHref} className="bg-surface-low">
      Back to quiz page
    </NavigationItem>
  );

  if (connection === 'replaced')
    return (
      <LiveNotice
        eyebrow="Opened elsewhere"
        tone="danger"
        title="This quiz is open on another device"
        description="Only one device per account can take part in a live quiz. Continue here to move your session to this device."
        action={
          <Button
            icon={<RefreshCw size={18} aria-hidden="true" />}
            onClick={() => window.location.reload()}
          >
            Use this device
          </Button>
        }
      />
    );

  if (connection === 'failed' && failure) {
    const known = refusals[failure.code];
    return (
      <LiveNotice
        eyebrow={known?.eyebrow ?? 'Unable to join'}
        tone={NEUTRAL_REFUSALS.has(failure.code) ? 'neutral' : 'danger'}
        title={known?.title ?? 'We could not join the live room'}
        description={failure.message}
        action={backToQuiz}
      />
    );
  }

  if (snapshot?.state === LIVE_SESSION_STATE.COMPLETED)
    return (
      <LiveNotice
        eyebrow="Quiz ended"
        title="This live quiz has ended"
        description="Thanks for taking part. Your results will be available in a later release."
        action={backToQuiz}
      />
    );

  if (connection !== 'connected' || !snapshot)
    return snapshot || connection !== 'connecting' ? (
      <ParticipantReconnecting
        quiz={quiz}
        attempt={attempt}
        maxAttempts={MAX_RECONNECT_ATTEMPTS}
        stopped={connection === 'failed'}
        stats={snapshot ? { connected: snapshot.counts.connected } : undefined}
        onRetry={reconnect}
      />
    ) : (
      <LiveNotice
        eyebrow="Connecting"
        title="Joining the live room…"
        description={`Connecting you to ${quiz.title}.`}
      />
    );

  return snapshot.state === LIVE_SESSION_STATE.LOBBY ? (
    <ParticipantLobby quiz={quiz} connected={snapshot.counts.connected} />
  ) : (
    <ParticipantLiveIdle quiz={quiz} participantName={participantName} />
  );
}
