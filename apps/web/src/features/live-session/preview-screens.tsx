import { APP_LINKS } from '@/config/navigation';
import { CurrentUserProvider } from '@/contexts/current-user-context';
import { WorkspaceShell } from '@/components/workspace/workspace-shell';
import { HostActiveQuestion } from './host-active-question';
import { HostConsoleHeader, HostConsoleLayout } from './host-console-layout';
import { HostLiveConflict } from './host-live-conflict';
import { HostLiveIdle } from './host-live-idle';
import { HostLobby } from './host-lobby';
import {
  LeaderboardPanel,
  ParticipantsPanel,
  QuizProgressPanel,
} from './host-rail';
import { LiveSessionShell } from './live-session-shell';
import {
  connectedParticipants,
  descriptiveQuestion,
  descriptiveQueue,
  idleQueue,
  liveCounts,
  liveQuiz,
  lobbyRoster,
  previewParticipantName,
  scoredQuestion,
  scoredQueue,
  hostQuestions,
} from './mock-data';
import {
  ParticipantLiveIdle,
  ParticipantLobby,
  ParticipantReconnecting,
} from './participant-screens';
import { QuestionQueue } from './question-queue';
import type { QueueQuestion } from './types';

// Development-only composition of the live screens with fixture data.

export const LIVE_PREVIEW_SCREENS = [
  { slug: 'host-lobby', title: 'Host lobby' },
  { slug: 'participant-lobby', title: 'Participant — joined lobby' },
  { slug: 'participant-reconnecting', title: 'Participant — reconnecting' },
  { slug: 'participant-live-idle', title: 'Participant — quiz live, idle' },
  { slug: 'host-conflict', title: 'Host — active quiz conflict' },
  { slug: 'host-live-idle', title: 'Host — quiz live, idle' },
  { slug: 'host-descriptive', title: 'Host — active descriptive question' },
  { slug: 'host-scored', title: 'Host — active scored question' },
] as const;

const previewHost = {
  id: 'preview',
  name: liveQuiz.hostName,
  email: 'elena@example.com',
  avatarUrl: null,
};

function askedCount(queue: QueueQuestion[]) {
  return queue.filter((question) => question.state === 'asked').length;
}

function HostRail({
  asked,
  submitted,
  questionLive,
}: {
  asked: number;
  submitted?: number | undefined;
  questionLive: boolean;
}) {
  return (
    <>
      <QuizProgressPanel
        asked={asked}
        questionCount={liveQuiz.questionCount}
        questionLive={questionLive}
      />
      <LeaderboardPanel canShowParticipants={!questionLive} />
      <ParticipantsPanel
        participants={connectedParticipants}
        connected={liveCounts.connected}
        registered={liveCounts.registered}
        submitted={submitted}
        allowLateJoin
      />
    </>
  );
}

function ActiveHostScreen({ kind }: { kind: 'scored' | 'descriptive' }) {
  const queue = kind === 'scored' ? scoredQueue : descriptiveQueue;
  const asked = askedCount(queue);
  const live = kind === 'scored' ? scoredQuestion : descriptiveQuestion;
  return (
    <LiveSessionShell>
      <HostConsoleLayout
        header={
          <HostConsoleHeader
            projectName={liveQuiz.projectName}
            quizTitle={liveQuiz.title}
            title={liveQuiz.title}
            description="A question is live. Submissions close automatically when its timer ends."
            status="Question live"
            connected={liveCounts.connected}
            registered={liveCounts.registered}
            asked={asked}
            questionCount={liveQuiz.questionCount}
          />
        }
        queue={
          <QuestionQueue
            questions={queue}
            defaultDurationSeconds={liveQuiz.defaultDurationSeconds}
          />
        }
        main={
          kind === 'scored' ? (
            <HostActiveQuestion
              kind="scored"
              question={scoredQuestion.question}
              results={scoredQuestion.results}
              questionCount={liveQuiz.questionCount}
              remainingSeconds={scoredQuestion.remainingSeconds}
              submitted={scoredQuestion.submitted}
              connected={liveCounts.connected}
            />
          ) : (
            <HostActiveQuestion
              kind="descriptive"
              question={descriptiveQuestion.question}
              responses={descriptiveQuestion.responses}
              questionCount={liveQuiz.questionCount}
              remainingSeconds={descriptiveQuestion.remainingSeconds}
              submitted={descriptiveQuestion.submitted}
              connected={liveCounts.connected}
            />
          )
        }
        rail={
          <HostRail asked={asked} submitted={live.submitted} questionLive />
        }
      />
    </LiveSessionShell>
  );
}

export function LivePreviewScreen({
  screen,
  publicUrl,
}: {
  screen: (typeof LIVE_PREVIEW_SCREENS)[number]['slug'];
  publicUrl: string;
}) {
  switch (screen) {
    case 'host-lobby':
      return (
        <LiveSessionShell>
          <HostLobby
            quiz={liveQuiz}
            roster={lobbyRoster}
            connected={liveCounts.connected}
            registered={liveCounts.registered}
            publicUrl={publicUrl}
            allowLateJoin
          />
        </LiveSessionShell>
      );
    case 'participant-lobby':
      return (
        <LiveSessionShell>
          <ParticipantLobby quiz={liveQuiz} connected={liveCounts.connected} />
        </LiveSessionShell>
      );
    case 'participant-reconnecting':
      return (
        <LiveSessionShell>
          <ParticipantReconnecting
            quiz={liveQuiz}
            attempt={2}
            maxAttempts={5}
            score={850}
            asked={3}
            connected={48}
          />
        </LiveSessionShell>
      );
    case 'participant-live-idle':
      return (
        <LiveSessionShell>
          <ParticipantLiveIdle
            quiz={liveQuiz}
            participantName={previewParticipantName}
          />
        </LiveSessionShell>
      );
    case 'host-conflict':
      return (
        <CurrentUserProvider initialUser={previewHost}>
          <WorkspaceShell>
            <HostLiveConflict
              activeQuizTitle={liveQuiz.title}
              activeProjectName={liveQuiz.projectName}
              startedLabel="Started 9m ago"
              stageLabel="Lobby open"
              connected={liveCounts.connected}
              registered={liveCounts.registered}
              asked={0}
              questionCount={liveQuiz.questionCount}
              waiting={connectedParticipants}
              returnHref="/dev/live/host-lobby"
              backHref={APP_LINKS.WORKSPACE.QUIZZES}
            />
          </WorkspaceShell>
        </CurrentUserProvider>
      );
    case 'host-live-idle': {
      const asked = askedCount(idleQueue);
      return (
        <LiveSessionShell>
          <HostLiveIdle
            header={
              <HostConsoleHeader
                projectName={liveQuiz.projectName}
                quizTitle={liveQuiz.title}
                title="Quiz is live"
                description="No question is active. Connected participants are waiting for your next question."
                status="Idle between questions"
                connected={liveCounts.connected}
                registered={liveCounts.registered}
                asked={asked}
                questionCount={liveQuiz.questionCount}
              />
            }
            questions={idleQueue}
            hostQuestions={hostQuestions}
            defaultDurationSeconds={liveQuiz.defaultDurationSeconds}
            rail={<HostRail asked={asked} questionLive={false} />}
          />
        </LiveSessionShell>
      );
    }
    case 'host-descriptive':
      return <ActiveHostScreen kind="descriptive" />;
    case 'host-scored':
      return <ActiveHostScreen kind="scored" />;
  }
}
