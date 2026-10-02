'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CircleX, DoorClosed, WifiOff } from 'lucide-react';
import {
  LIVE_EVENTS,
  type HostCurrentQuestionDto,
  type HostLiveQuestionDto,
  type HostLiveSnapshotDto,
  type LeaderboardDto,
  ERROR_CODE,
  LIVE_ROLE,
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
}: {
  entry: QueueQuestion;
  question: HostLiveQuestionDto;
  current: HostCurrentQuestionDto;
  questionCount: number;
  connected: number;
  clockOffsetMs: number;
  onExpired: () => unknown;
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
  const router = useRouter();
  const manageHref = APP_LINKS.WORKSPACE.MANAGE_QUIZ(quizId);
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
          resultsHref={APP_LINKS.WORKSPACE.QUIZ_RESULTS(quizId)}
          dashboardHref={APP_LINKS.WORKSPACE.DASHBOARD}
        />
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
  const notices =
    status || problem ? (
      <div className="mx-auto w-full max-w-content space-y-space-xs px-margin-sm pt-space-md md:px-margin lg:px-margin-lg">
        {status}
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
    </>
  );
}
