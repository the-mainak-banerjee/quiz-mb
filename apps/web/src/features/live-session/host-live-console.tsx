'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, CircleX, DoorClosed, WifiOff } from 'lucide-react';
import {
  LIVE_EVENTS,
  type HostLiveSnapshotDto,
  ERROR_CODE,
  LIVE_ROLE,
  LIVE_SESSION_STATE,
} from '@quizmb/contracts';
import { Button, Callout, Text } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { APP_LINKS } from '@/config/navigation';
import { HostConsoleHeader } from './host-console-layout';
import { HostLiveIdle } from './host-live-idle';
import { HostLobby } from './host-lobby';
import {
  LeaderboardPanel,
  ParticipantsPanel,
  QuizProgressPanel,
} from './host-rail';
import { LiveNotice } from './participant-screens';
import { MAX_RECONNECT_ATTEMPTS, useLiveSession } from './use-live-session';
import {
  toHostQuestions,
  toQueue,
  toQuizSummary,
  toRoster,
} from './view-models';

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
  const { snapshot, connection, failure, attempt, command, reconnect } =
    useLiveSession(liveSessionId);
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
    return (
      <LiveNotice
        eyebrow="Quiz ended"
        title="This live quiz has ended"
        description="The session is closed. Detailed results arrive in a later release."
        action={backToQuiz}
      />
    );

  const quiz = toQuizSummary(host.quiz);
  const roster = toRoster(host);
  const onLateJoinChange = (allow: boolean) =>
    void run(LIVE_EVENTS.lateJoinSet, { allow });
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
      ) : (
        <HostLiveIdle
          header={
            <HostConsoleHeader
              projectName={quiz.projectName}
              quizTitle={quiz.title}
              title="Quiz is live"
              description="No question is active. Connected participants are waiting for your next question."
              status="Idle between questions"
              connected={host.counts.connected}
              registered={host.counts.registered}
              asked={0}
              questionCount={quiz.questionCount}
            />
          }
          questions={toQueue(host.questions)}
          hostQuestions={toHostQuestions(host.questions)}
          defaultDurationSeconds={quiz.defaultDurationSeconds}
          rail={
            <>
              <QuizProgressPanel
                asked={0}
                questionCount={quiz.questionCount}
                questionLive={false}
                onEndQuiz={() => setConfirming('end')}
              />
              <LeaderboardPanel canShowParticipants />
              <ParticipantsPanel
                participants={roster.filter(
                  (participant) => participant.connected,
                )}
                connected={host.counts.connected}
                registered={host.counts.registered}
                allowLateJoin={host.allowLateJoin}
                onLateJoinChange={onLateJoinChange}
              />
            </>
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
