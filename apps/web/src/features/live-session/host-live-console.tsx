'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNavigationGuard } from 'nextjs-nav-guard';
import {
  AlertTriangle,
  CircleX,
  DoorClosed,
  Eye,
  LogOut,
  WifiOff,
} from 'lucide-react';
import {
  LIVE_EVENTS,
  type HostCurrentQuestionDto,
  type HostLiveQuestionDto,
  type HostLiveSnapshotDto,
  type LeaderboardDto,
  ERROR_CODE,
  LIVE_ROLE,
  LIVE_SESSION_LIMITS,
  LIVE_SESSION_STATE,
  QUESTION_TYPE,
} from '@quizmb/contracts';
import { Button, Callout, Text } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { APP_LINKS } from '@/config/navigation';
import { HostActiveQuestion } from './host-active-question';
import { HostConsoleHeader, HostConsoleLayout } from './host-console-layout';
import { HostLiveIdle } from './host-live-idle';
import { HostLobby } from './host-lobby';
import { SessionEndingCallout, useEndingSoon } from './session-ending-notice';
import { HostQuizCompleted } from './quiz-completed';
import { HostLeaderboardView } from './leaderboard';
import {
  LeaderboardPanel,
  ParticipantsPanel,
  QuizProgressPanel,
} from './host-rail';
import { LiveNotice } from './participant-screens';
import { QuestionQueue } from './question-queue';
import type { QueueQuestion } from './types';
import { useRemainingSeconds } from './use-countdown';
import { MAX_RECONNECT_ATTEMPTS, useLiveSession } from './use-live-session';
import {
  toHostQuestions,
  toOptionResults,
  toQueue,
  toQuizSummary,
  toResponses,
  toRoster,
} from './view-models';

/** While the countdown shows zero, ask the server to close the question. */
const CLOSE_NUDGE_MS = 2_000;

/** The running question with its live countdown and answer progress. */
function ActiveQuestionMain({
  entry,
  question,
  current,
  questionCount,
  connected,
  clockOffsetMs,
  onExpired,
  allAsked,
}: {
  entry: QueueQuestion;
  question: HostLiveQuestionDto;
  current: HostCurrentQuestionDto;
  questionCount: number;
  connected: number;
  clockOffsetMs: number;
  onExpired: () => unknown;
  allAsked: boolean;
}) {
  const remainingSeconds = useRemainingSeconds(current.endsAt, clockOffsetMs);
  const expired = !current.ended && remainingSeconds === 0;
  useEffect(() => {
    if (!expired) return;
    const timer = window.setInterval(onExpired, CLOSE_NUDGE_MS);
    return () => window.clearInterval(timer);
  }, [expired, onExpired]);
  const shared = {
    question: entry,
    questionCount,
    remainingSeconds: current.ended ? 0 : remainingSeconds,
    submitted: current.submittedCount,
    connected,
    ended: current.ended,
    allAsked,
  };
  return question.type === QUESTION_TYPE.DESCRIPTIVE ? (
    <HostActiveQuestion
      {...shared}
      kind="descriptive"
      responses={toResponses(current)}
    />
  ) : (
    <HostActiveQuestion
      {...shared}
      kind="scored"
      results={toOptionResults(question, current)}
    />
  );
}

const confirmations = {
  end: {
    title: 'End this quiz?',
    description:
      'The live session closes for everyone and the quiz is marked completed. This cannot be undone.',
    cancel: 'Keep quiz live',
    confirm: 'End quiz',
    event: LIVE_EVENTS.quizEnd,
  },
  close: {
    title: 'Close this lobby?',
    description:
      'Everyone waiting is sent back to the quiz page. The quiz stays published with all registrations, and you can open the lobby again later.',
    cancel: 'Keep lobby open',
    confirm: 'Close lobby',
    event: LIVE_EVENTS.lobbyClose,
  },
} as const;

/** Host live console driven by the authoritative realtime snapshot. */
export function HostLiveConsole({
  liveSessionId,
  quizId,
  publicUrl,
}: {
  liveSessionId: string;
  quizId: string;
  publicUrl: string;
}) {
  const {
    snapshot,
    connection,
    failure,
    attempt,
    command,
    query,
    reconnect,
    clockOffsetMs,
    resync,
  } = useLiveSession(liveSessionId);
  /** Host-only leaderboard preview; participants' screens do not change. */
  const [privateBoard, setPrivateBoard] = useState<LeaderboardDto | null>(null);
  /** Bumped when the host opens or shows the leaderboard, to scroll to it. */
  const [boardFocus, setBoardFocus] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<
    keyof typeof confirmations | null
  >(null);
  /** The host asked to close before revealing the final leaderboard. */
  const [confirmClose, setConfirmClose] = useState(false);
  /** Set once the session is closed, so leaving is no longer guarded. */
  const leaving = useRef(false);
  const router = useRouter();
  const manageHref = APP_LINKS.WORKSPACE.MANAGE_QUIZ(quizId);
  const resultsHref = APP_LINKS.WORKSPACE.QUIZ_RESULTS(quizId);
  const hostSnapshot = snapshot?.role === LIVE_ROLE.HOST ? snapshot : null;
  const state = hostSnapshot?.state ?? null;
  const unavailable = connection === 'failed' && !!failure;
  // Leaving mid-quiz asks first; the quiz keeps running without the host.
  const quizLive =
    !unavailable &&
    state !== null &&
    state !== LIVE_SESSION_STATE.LOBBY &&
    state !== LIVE_SESSION_STATE.COMPLETED;
  // After the end, leaving closes the room for everyone.
  const roomOpen =
    !unavailable &&
    connection === 'connected' &&
    state === LIVE_SESSION_STATE.COMPLETED &&
    !!hostSnapshot?.final;
  const revealed = !!hostSnapshot?.final?.leaderboardShown;
  // Exit and browser Back only: a refresh just reconnects.
  const guard = useNavigationGuard({
    enabled: ({ type }) =>
      (type === 'push' || type === 'replace' || type === 'popstate') &&
      !leaving.current &&
      (quizLive || roomOpen),
  });
  const sessionClosed =
    connection === 'failed' && failure?.code === ERROR_CODE.SESSION_CLOSED;
  // Closed elsewhere (another tab, or by the server after a while).
  useEffect(() => {
    if (!sessionClosed) return;
    leaving.current = true;
    const timer = window.setTimeout(() => router.replace(resultsHref), 3_000);
    return () => window.clearTimeout(timer);
  }, [sessionClosed, resultsHref, router]);
  const lobbyExpired =
    connection === 'failed' && failure?.code === ERROR_CODE.LOBBY_EXPIRED;
  // An expired lobby takes the host back to quiz management.
  useEffect(() => {
    if (!lobbyExpired) return;
    const timer = window.setTimeout(() => router.replace(manageHref), 5_000);
    return () => window.clearTimeout(timer);
  }, [lobbyExpired, manageHref, router]);
  // Exit or Back after the end: close the room instead of just leaving it.
  const exitAfterEnd = guard.active && roomOpen;
  useEffect(() => {
    if (!exitAfterEnd) return;
    guard.reject();
    requestClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per attempt
  }, [exitAfterEnd]);
  const endingSoon = useEndingSoon(
    snapshot?.sessionEndsAt ?? null,
    clockOffsetMs,
  );
  const backToQuiz = (
    <NavigationItem href={manageHref} className="bg-surface-low">
      Back to quiz
    </NavigationItem>
  );

  async function run(event: string, extra?: Record<string, unknown>) {
    setBusy(true);
    setError('');
    const ack = await command(event, extra);
    setBusy(false);
    if (!ack.ok) setError(ack.error.message);
    return ack.ok;
  }

  /** Closes the room for everyone, then shows the full results. */
  async function closeSession(reveal = false) {
    if (reveal && !(await run(LIVE_EVENTS.finalLeaderboardShow))) return;
    if (!(await run(LIVE_EVENTS.sessionClose))) return;
    setConfirmClose(false);
    leaving.current = true;
    router.replace(resultsHref);
  }
  /** Close session (or Exit after the end): asks first if not revealed. */
  function requestClose() {
    if (revealed) void closeSession();
    else setConfirmClose(true);
  }

  if (sessionClosed)
    return (
      <LiveNotice
        eyebrow="Session closed"
        title="This live session has closed"
        description={`${failure.message} Taking you to the full results…`}
      />
    );
  if (connection === 'failed' && failure?.code === ERROR_CODE.LOBBY_EXPIRED)
    return (
      <LiveNotice
        eyebrow="Lobby expired"
        title="The lobby closed automatically"
        description={`${failure.message} The quiz is still published with its registrations, and you can open the lobby again. Taking you back to the quiz…`}
        action={backToQuiz}
      />
    );
  if (connection === 'failed' && failure?.code === ERROR_CODE.LOBBY_CLOSED)
    return (
      <LiveNotice
        eyebrow="Lobby closed"
        title="This lobby was closed"
        description="It was closed from another tab. The quiz is still published, and you can open the lobby again from its page."
        action={backToQuiz}
      />
    );
  if (connection === 'failed' && failure)
    return (
      <LiveNotice
        eyebrow="Live room unavailable"
        tone="danger"
        title="We couldn't open your live room"
        description={failure.message}
        action={backToQuiz}
      />
    );
  if (!snapshot || snapshot.role !== LIVE_ROLE.HOST)
    return (
      <LiveNotice
        eyebrow={connection === 'failed' ? 'Connection lost' : 'Connecting'}
        tone={connection === 'failed' ? 'danger' : 'neutral'}
        title={
          connection === 'failed'
            ? 'The live room is not responding'
            : 'Opening your live room…'
        }
        description={
          connection === 'failed'
            ? 'Check your connection and try again.'
            : 'Connecting to the live session server.'
        }
        action={
          connection === 'failed' ? (
            <Button onClick={reconnect}>Try again</Button>
          ) : undefined
        }
      />
    );

  const dialogs = (
    <>
      <Modal
        open={confirmClose}
        onOpenChange={(open) => !open && setConfirmClose(false)}
        title="Close without the final leaderboard?"
        description="Participants haven't seen the final leaderboard yet. Closing the session disconnects everyone; they keep their own result."
      >
        <div className="flex flex-col-reverse gap-space-xs sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setConfirmClose(false)}>
            Cancel
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            icon={<DoorClosed size={18} aria-hidden="true" />}
            onClick={() => void closeSession()}
          >
            Close without revealing
          </Button>
          <Button
            disabled={busy}
            icon={<Eye size={18} aria-hidden="true" />}
            onClick={() => void closeSession(true)}
          >
            Reveal and close
          </Button>
        </div>
        {error && (
          <Text
            role="alert"
            variant="caption"
            className="mt-space-sm text-danger"
          >
            {error}
          </Text>
        )}
      </Modal>
      <Modal
        open={guard.active && quizLive}
        onOpenChange={(open) => !open && guard.reject()}
        title="Leave the live quiz?"
        description={`The quiz keeps running without you. Participants are told you're away, and if you don't return within ${LIVE_SESSION_LIMITS.hostGraceMinutes} minutes the quiz ends automatically with the results so far.`}
      >
        <div className="flex flex-col-reverse gap-space-xs sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={guard.reject}>
            Stay in the quiz
          </Button>
          <Button
            variant="danger"
            icon={<LogOut size={18} aria-hidden="true" />}
            onClick={guard.accept}
          >
            Leave
          </Button>
        </div>
      </Modal>
    </>
  );

  const host: HostLiveSnapshotDto = snapshot;
  if (host.state === LIVE_SESSION_STATE.COMPLETED)
    return host.final ? (
      <>
        {error && (
          <div className="mx-auto w-full max-w-5xl px-margin-sm pt-space-md md:px-margin">
            <Callout
              role="alert"
              icon={<AlertTriangle size={16} aria-hidden="true" />}
              className="bg-danger-surface text-danger-on-surface"
            >
              {error}
            </Callout>
          </div>
        )}
        <HostQuizCompleted
          quiz={{ title: host.quiz.title, projectName: host.quiz.projectName }}
          summary={host.final.summary}
          board={host.final.leaderboard}
          shown={host.final.leaderboardShown}
          busy={busy || connection !== 'connected'}
          onReveal={() => void run(LIVE_EVENTS.finalLeaderboardShow)}
          onClose={requestClose}
        />
        {dialogs}
      </>
    ) : (
      <LiveNotice
        eyebrow="Quiz ended"
        title="This live quiz has ended"
        description="The session is closed."
        action={backToQuiz}
      />
    );

  const quiz = toQuizSummary(host.quiz);
  const roster = toRoster(host);
  const onLateJoinChange = (allow: boolean) =>
    void run(LIVE_EVENTS.lateJoinSet, { allow });
  const current = host.currentQuestion;
  const activeId =
    host.state === LIVE_SESSION_STATE.QUESTION_ACTIVE && current
      ? current.questionId
      : null;
  const queue = toQueue(
    host.questions,
    new Set(host.askedQuestions.map((item) => item.questionId)),
    activeId,
  );
  const asked = host.askedQuestions.length;
  const allAsked = asked >= quiz.questionCount;
  const activeEntry = queue.find((item) => item.id === activeId);
  const activeQuestion = host.questions.find((item) => item.id === activeId);
  const showing = host.state === LIVE_SESSION_STATE.LEADERBOARD;
  const betweenQuestions =
    host.state === LIVE_SESSION_STATE.QUESTION_RESULT || showing;
  const justEnded = betweenQuestions ? current : null;
  const board = showing ? host.leaderboard : privateBoard;
  async function viewLeaderboard() {
    setBusy(true);
    setError('');
    const ack = await query<LeaderboardDto>(LIVE_EVENTS.leaderboardGet);
    setBusy(false);
    if (ack.ok) {
      setPrivateBoard(ack.data);
      setBoardFocus((count) => count + 1);
    } else setError(ack.error.message);
  }
  const showLeaderboard = async () => {
    if (!(await run(LIVE_EVENTS.leaderboardShow))) return;
    setPrivateBoard(null);
    setBoardFocus((count) => count + 1);
  };
  const hideLeaderboard = () => void run(LIVE_EVENTS.leaderboardHide);
  const endedEntry = queue.find((item) => item.id === justEnded?.questionId);
  const endedQuestion = host.questions.find(
    (item) => item.id === justEnded?.questionId,
  );
  const header = (
    <HostConsoleHeader
      projectName={quiz.projectName}
      quizTitle={quiz.title}
      title={
        activeId
          ? 'Question live'
          : showing
            ? 'Leaderboard on screen'
            : justEnded
              ? `Question ${justEnded.number} ended`
              : 'Quiz is live'
      }
      description={
        activeId
          ? 'Submissions close automatically when the timer ends.'
          : allAsked
            ? showing
              ? 'Participants see the top 10. Every question has been asked. Hide it, or end the quiz when you are ready.'
              : 'Every question has been asked. Show the leaderboard, or end the quiz when you are ready.'
            : showing
              ? 'Participants see the top 10. Hide it, or select the next question when you are ready.'
              : justEnded
                ? 'Participants now see the correct answer and their own result. Choose the next question when you are ready.'
                : 'No question is active. Connected participants are waiting for your next question.'
      }
      status={
        activeId
          ? 'Question live'
          : showing
            ? 'Showing leaderboard'
            : 'Idle between questions'
      }
      connected={host.counts.connected}
      registered={host.counts.registered}
      asked={asked}
      questionCount={quiz.questionCount}
    />
  );
  const rail = (
    <>
      <QuizProgressPanel
        asked={asked}
        questionCount={quiz.questionCount}
        questionLive={!!activeId}
        onEndQuiz={() => setConfirming('end')}
      />
      <LeaderboardPanel
        canShowParticipants={betweenQuestions}
        shown={showing}
        busy={busy}
        onView={() => void viewLeaderboard()}
        onShow={() => void showLeaderboard()}
        onHide={hideLeaderboard}
      />
      <ParticipantsPanel
        participants={roster.filter((participant) => participant.connected)}
        connected={host.counts.connected}
        registered={host.counts.registered}
        submitted={activeId ? current?.submittedCount : undefined}
        allowLateJoin={host.allowLateJoin}
        onLateJoinChange={onLateJoinChange}
      />
    </>
  );
  const status =
    connection === 'connected' ? null : (
      <Callout
        role="status"
        icon={<WifiOff size={16} aria-hidden="true" />}
        className="bg-status-scheduled-surface text-status-scheduled-text"
      >
        {connection === 'failed' ? (
          <span className="flex flex-wrap items-center justify-between gap-space-xs">
            Connection lost. Check your network, then try again.
            <Button variant="outline" onClick={reconnect}>
              Try again
            </Button>
          </span>
        ) : (
          `Reconnecting to the live room${
            attempt ? ` (attempt ${attempt} of ${MAX_RECONNECT_ATTEMPTS})` : ''
          }… Controls resume automatically.`
        )}
      </Callout>
    );
  const problem = error ? (
    <Callout
      role="alert"
      icon={<AlertTriangle size={16} aria-hidden="true" />}
      className="bg-danger-surface text-danger-on-surface"
    >
      {error}
    </Callout>
  ) : null;
  const ending =
    endingSoon && host.sessionEndsAt ? (
      <SessionEndingCallout endsAt={host.sessionEndsAt} />
    ) : null;
  const notices =
    status || problem || ending ? (
      <div className="mx-auto w-full max-w-content space-y-space-xs px-margin-sm pt-space-md md:px-margin lg:px-margin-lg">
        {status}
        {ending}
        {problem}
      </div>
    ) : null;

  return (
    <>
      {notices}
      {host.state === LIVE_SESSION_STATE.LOBBY ? (
        <HostLobby
          quiz={quiz}
          roster={roster}
          connected={host.counts.connected}
          registered={host.counts.registered}
          publicUrl={publicUrl}
          allowLateJoin={host.allowLateJoin}
          busy={busy || connection !== 'connected'}
          allowance={host.hostingAllowance}
          lobbyExpiresAt={host.lobbyExpiresAt}
          onStartQuiz={() => void run(LIVE_EVENTS.quizStart)}
          onCloseLobby={() => setConfirming('close')}
          onLateJoinChange={onLateJoinChange}
        />
      ) : activeId && current && activeEntry && activeQuestion ? (
        <HostConsoleLayout
          header={header}
          queue={
            <QuestionQueue
              questions={queue}
              defaultDurationSeconds={quiz.defaultDurationSeconds}
            />
          }
          main={
            <ActiveQuestionMain
              key={current.askedQuestionId}
              entry={activeEntry}
              question={activeQuestion}
              current={current}
              questionCount={quiz.questionCount}
              connected={host.counts.connected}
              clockOffsetMs={clockOffsetMs}
              onExpired={resync}
              allAsked={allAsked}
            />
          }
          rail={rail}
        />
      ) : (
        <HostLiveIdle
          key={board ? 'leaderboard' : 'question'}
          header={header}
          questions={queue}
          hostQuestions={toHostQuestions(host.questions)}
          defaultDurationSeconds={quiz.defaultDurationSeconds}
          rail={rail}
          asking={busy}
          onAsk={(questionId) => {
            setPrivateBoard(null);
            void run(LIVE_EVENTS.questionStart, { questionId });
          }}
          idleMain={
            board ? (
              <HostLeaderboardView
                board={board}
                shown={showing}
                busy={busy}
                onShow={() => void showLeaderboard()}
                onHide={hideLeaderboard}
                onClose={() => setPrivateBoard(null)}
                focusKey={boardFocus}
              />
            ) : justEnded && endedEntry && endedQuestion ? (
              <ActiveQuestionMain
                key={justEnded.askedQuestionId}
                entry={endedEntry}
                question={endedQuestion}
                current={justEnded}
                questionCount={quiz.questionCount}
                connected={host.counts.connected}
                clockOffsetMs={clockOffsetMs}
                onExpired={resync}
                allAsked={allAsked}
              />
            ) : undefined
          }
        />
      )}

      <Modal
        open={confirming !== null}
        onOpenChange={(open) => !open && setConfirming(null)}
        title={confirmations[confirming ?? 'end'].title}
        description={confirmations[confirming ?? 'end'].description}
      >
        <div className="flex flex-col-reverse gap-space-xs sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => setConfirming(null)}>
            {confirmations[confirming ?? 'end'].cancel}
          </Button>
          <Button
            variant="danger"
            disabled={busy}
            icon={
              confirming === 'close' ? (
                <DoorClosed size={18} aria-hidden="true" />
              ) : (
                <CircleX size={18} aria-hidden="true" />
              )
            }
            onClick={async () => {
              const action = confirming;
              if (!action) return;
              if (!(await run(confirmations[action].event))) return;
              setConfirming(null);
              if (action === 'close') router.push(manageHref);
            }}
          >
            {confirmations[confirming ?? 'end'].confirm}
          </Button>
        </div>
        {error && (
          <Text
            role="alert"
            variant="caption"
            className="mt-space-sm text-danger"
          >
            {error}
          </Text>
        )}
      </Modal>
      {dialogs}
    </>
  );
}
