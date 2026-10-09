'use client';

import { RefreshCw } from 'lucide-react';
import {
  ERROR_CODE,
  LIVE_ROLE,
  LIVE_SESSION_STATE,
  type LiveQuizInfoDto,
} from '@quizmb/contracts';
import { Button } from '@/components/ui';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { ParticipantLeaderboard } from './leaderboard';
import { APP_LINKS } from '@/config/navigation';
import { ParticipantLiveQuestion } from './participant-live-question';
import { ParticipantQuizEnded } from './quiz-completed';
import {
  LiveNotice,
  ParticipantLiveIdle,
  ParticipantLobby,
  ParticipantReconnecting,
} from './participant-screens';
import { MAX_RECONNECT_ATTEMPTS, useLiveSession } from './use-live-session';
import { toQuizSummary } from './view-models';
import { HostAwayNotice, SessionClosedNotice } from './host-away-notice';
import { SessionEndingNotice, useEndingSoon } from './session-ending-notice';

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
  [ERROR_CODE.LOBBY_EXPIRED]: {
    eyebrow: 'Lobby expired',
    title: 'The lobby expired before the quiz started',
  },
  [ERROR_CODE.SESSION_CLOSED]: {
    eyebrow: 'Session closed',
    title: 'This live session has closed',
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
  ERROR_CODE.LOBBY_EXPIRED,
  ERROR_CODE.SESSION_CLOSED,
]);

/** Participant live experience driven by the authoritative snapshot. */
export function ParticipantLiveView({
  liveSessionId,
  quiz: initialQuiz,
  participantId,
  participantName,
  quizHref,
}: {
  liveSessionId: string;
  /** Server-loaded quiz details for screens shown before the first snapshot. */
  quiz: LiveQuizInfoDto;
  /** The signed-in user, to highlight their own leaderboard row. */
  participantId: string;
  participantName: string;
  quizHref: string;
}) {
  const {
    snapshot,
    connection,
    failure,
    attempt,
    reconnect,
    myAnswer,
    myStanding,
    finalResult,
    lateJoinQuestionId,
    clockOffsetMs,
    submitAnswer,
    resync,
  } = useLiveSession(liveSessionId);
  const quiz = toQuizSummary(snapshot?.quiz ?? initialQuiz);
  const endingSoon = useEndingSoon(
    snapshot?.sessionEndsAt ?? null,
    clockOffsetMs,
  );
  const historyLink = (
    <NavigationItem
      href={APP_LINKS.WORKSPACE.HISTORY}
      className="bg-surface-low"
    >
      Open history
    </NavigationItem>
  );
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

  // After the end: the final leaderboard once the host reveals it,
  // otherwise this participant's own result. There is no rejoining; when
  // the room closes, the screen stays with a note.
  if (snapshot?.state === LIVE_SESSION_STATE.COMPLETED) {
    const closed =
      failure?.code === ERROR_CODE.SESSION_CLOSED ? (
        <SessionClosedNotice message={failure.message} />
      ) : null;
    if (snapshot.role === LIVE_ROLE.PARTICIPANT && snapshot.leaderboard)
      return (
        <>
          <ParticipantLeaderboard
            board={snapshot.leaderboard}
            standing={finalResult}
            participantId={participantId}
            final
          />
          {closed}
        </>
      );
    return (
      <>
        <ParticipantQuizEnded
          quizTitle={quiz.title}
          result={finalResult}
          closed={!!closed}
        />
        {closed}
      </>
    );
  }

  if (connection === 'failed' && failure) {
    const known = refusals[failure.code];
    return (
      <LiveNotice
        eyebrow={known?.eyebrow ?? 'Unable to join'}
        tone={NEUTRAL_REFUSALS.has(failure.code) ? 'neutral' : 'danger'}
        title={known?.title ?? 'We could not join the live room'}
        description={failure.message}
        action={
          failure.code === ERROR_CODE.QUIZ_COMPLETED ||
          failure.code === ERROR_CODE.SESSION_CLOSED
            ? historyLink
            : backToQuiz
        }
      />
    );
  }

  if (connection !== 'connected' || !snapshot)
    return snapshot || connection !== 'connecting' ? (
      <ParticipantReconnecting
        quiz={quiz}
        attempt={attempt}
        maxAttempts={MAX_RECONNECT_ATTEMPTS}
        stopped={connection === 'failed'}
        stats={
          snapshot
            ? {
                connected: snapshot.counts.connected,
                ...(myStanding ? { score: myStanding.totalScore } : {}),
              }
            : undefined
        }
        onRetry={reconnect}
      />
    ) : (
      <LiveNotice
        eyebrow="Connecting"
        title="Joining the live room…"
        description={`Connecting you to ${quiz.title}.`}
      />
    );

  /** The participant screen for the current live state. */
  function renderScreen() {
    if (!snapshot) return null;
    if (snapshot.role === LIVE_ROLE.PARTICIPANT && snapshot.leaderboard)
      return (
        <ParticipantLeaderboard
          board={snapshot.leaderboard}
          // A standing from an earlier question is still being recalculated.
          standing={
            myStanding?.askedQuestionId === snapshot.question?.askedQuestionId
              ? myStanding
              : null
          }
          participantId={participantId}
        />
      );

    if (snapshot.role === LIVE_ROLE.PARTICIPANT && snapshot.question)
      return (
        <ParticipantLiveQuestion
          key={snapshot.question.askedQuestionId}
          question={snapshot.question}
          myAnswer={myAnswer}
          myStanding={myStanding}
          joinedDuringQuestion={
            lateJoinQuestionId === snapshot.question.askedQuestionId
          }
          clockOffsetMs={clockOffsetMs}
          submitAnswer={submitAnswer}
          resync={resync}
        />
      );

    return snapshot.state === LIVE_SESSION_STATE.LOBBY ? (
      <ParticipantLobby quiz={quiz} connected={snapshot.counts.connected} />
    ) : (
      <ParticipantLiveIdle quiz={quiz} participantName={participantName} />
    );
  }

  const hostAway =
    snapshot.role === LIVE_ROLE.PARTICIPANT && !snapshot.hostConnected;
  return (
    <>
      {renderScreen()}
      {endingSoon && snapshot.sessionEndsAt && (
        <SessionEndingNotice
          endsAt={snapshot.sessionEndsAt}
          raised={hostAway}
        />
      )}
      {hostAway && (
        <HostAwayNotice
          questionOpen={
            snapshot.state === LIVE_SESSION_STATE.QUESTION_ACTIVE && !myAnswer
          }
        />
      )}
    </>
  );
}
