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
  participantQuestions,
  previewDescriptiveAnswer,
  previewLeaderboard,
  previewParticipantId,
  previewResult,
  previewStanding,
  type ParticipantQuestionFixture,
} from './mock-data';
import { HostLeaderboardView, ParticipantLeaderboard } from './leaderboard';
import { ParticipantQuestionView } from './participant-question';
import { ParticipantQuestionDemo } from './participant-question-demo';
import type { ParticipantQuestionPhase, SubmittedAnswer } from './types';
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
  {
    slug: 'participant-flow-single',
    title: 'Participant — single choice, full flow (interactive)',
  },
  {
    slug: 'participant-flow-multiple',
    title: 'Participant — multiple answer, full flow (interactive)',
  },
  {
    slug: 'participant-flow-descriptive',
    title: 'Participant — descriptive, full flow (interactive)',
  },
  {
    slug: 'participant-single-active',
    title: 'Participant — single choice, answering',
  },
  {
    slug: 'participant-multiple-active',
    title: 'Participant — multiple answer, answering',
  },
  {
    slug: 'participant-descriptive-active',
    title: 'Participant — descriptive, answering',
  },
  {
    slug: 'participant-late-join',
    title: 'Participant — late join, answering',
  },
  {
    slug: 'participant-submitted',
    title: 'Participant — submitted and locked',
  },
  {
    slug: 'participant-time-up',
    title: 'Participant — time up, checking answers',
  },
  {
    slug: 'participant-result-updating',
    title: 'Participant — revealed, updating score and rank',
  },
  {
    slug: 'participant-result-correct',
    title: 'Participant — result, correct',
  },
  {
    slug: 'participant-result-incorrect',
    title: 'Participant — result, incorrect',
  },
  {
    slug: 'participant-result-not-attempted',
    title: 'Participant — result, not attempted',
  },
  {
    slug: 'participant-result-multiple',
    title: 'Participant — result, multiple answer',
  },
  {
    slug: 'participant-result-descriptive',
    title: 'Participant — result, descriptive',
  },
  {
    slug: 'host-leaderboard-private',
    title: 'Host — leaderboard, private view',
  },
  {
    slug: 'host-leaderboard-shown',
    title: 'Host — leaderboard shown to participants',
  },
  {
    slug: 'participant-leaderboard-top',
    title: 'Participant — leaderboard, in the top 10',
  },
  {
    slug: 'participant-leaderboard-outside',
    title: 'Participant — leaderboard, outside the top 10',
  },
] as const;

type PreviewSlug = (typeof LIVE_PREVIEW_SCREENS)[number]['slug'];

const previewHost = {
  id: 'preview',
  name: liveQuiz.hostName,
  email: 'elena@example.com',
  avatarUrl: null,
};

const { single, multiple, descriptive } = participantQuestions;
const singleAnswer: SubmittedAnswer = {
  selectedOptionIds: ['option-b'],
  answerText: null,
};

/** A fixed revealed phase for a fixture and answer. */
function revealed(
  fixture: ParticipantQuestionFixture,
  answer: SubmittedAnswer | null,
  withStanding = true,
): ParticipantQuestionPhase {
  const result = previewResult(fixture, answer);
  return {
    kind: 'revealed',
    result,
    standing: withStanding ? previewStanding(result) : null,
  };
}

const participantPreviews: Partial<
  Record<
    PreviewSlug,
    {
      fixture: ParticipantQuestionFixture;
      phase: ParticipantQuestionPhase;
      lateJoin?: boolean;
      defaultSelectedOptionIds?: string[];
      defaultAnswerText?: string;
    }
  >
> = {
  'participant-single-active': {
    fixture: single,
    phase: { kind: 'answering', remainingSeconds: 11 },
    defaultSelectedOptionIds: ['option-b'],
  },
  'participant-multiple-active': {
    fixture: multiple,
    phase: { kind: 'answering', remainingSeconds: 18 },
    defaultSelectedOptionIds: ['tier-a', 'tier-b'],
  },
  'participant-descriptive-active': {
    fixture: descriptive,
    phase: { kind: 'answering', remainingSeconds: 42 },
    defaultAnswerText: previewDescriptiveAnswer,
  },
  'participant-late-join': {
    fixture: single,
    phase: { kind: 'answering', remainingSeconds: 8 },
    lateJoin: true,
  },
  'participant-submitted': {
    fixture: single,
    phase: { kind: 'submitted', remainingSeconds: 7, answer: singleAnswer },
  },
  'participant-time-up': {
    fixture: single,
    phase: { kind: 'closed', answer: singleAnswer },
  },
  'participant-result-updating': {
    fixture: single,
    phase: revealed(single, singleAnswer, false),
  },
  'participant-result-correct': {
    fixture: single,
    phase: revealed(single, singleAnswer),
  },
  'participant-result-incorrect': {
    fixture: single,
    phase: revealed(single, {
      selectedOptionIds: ['option-c'],
      answerText: null,
    }),
  },
  'participant-result-not-attempted': {
    fixture: single,
    phase: revealed(single, null),
  },
  'participant-result-multiple': {
    fixture: multiple,
    phase: revealed(multiple, {
      selectedOptionIds: ['tier-a', 'tier-b'],
      answerText: null,
    }),
  },
  'participant-result-descriptive': {
    fixture: descriptive,
    phase: revealed(descriptive, {
      selectedOptionIds: [],
      answerText: previewDescriptiveAnswer,
    }),
  },
};

const flowPreviews: Partial<Record<PreviewSlug, ParticipantQuestionFixture>> = {
  'participant-flow-single': single,
  'participant-flow-multiple': multiple,
  'participant-flow-descriptive': descriptive,
};

function askedCount(queue: QueueQuestion[]) {
  return queue.filter((question) => question.state === 'asked').length;
}

function HostRail({
  asked,
  submitted,
  questionLive,
  leaderboardShown = false,
}: {
  asked: number;
  submitted?: number | undefined;
  questionLive: boolean;
  leaderboardShown?: boolean;
}) {
  return (
    <>
      <QuizProgressPanel
        asked={asked}
        questionCount={liveQuiz.questionCount}
        questionLive={questionLive}
      />
      <LeaderboardPanel
        canShowParticipants={!questionLive}
        shown={leaderboardShown}
      />
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
  screen: PreviewSlug;
  publicUrl: string;
}) {
  const flow = flowPreviews[screen];
  if (flow) {
    return (
      <LiveSessionShell>
        <ParticipantQuestionDemo fixture={flow} />
      </LiveSessionShell>
    );
  }
  if (
    screen === 'host-leaderboard-private' ||
    screen === 'host-leaderboard-shown'
  ) {
    const shown = screen === 'host-leaderboard-shown';
    const asked = askedCount(idleQueue);
    return (
      <LiveSessionShell>
        <HostConsoleLayout
          header={
            <HostConsoleHeader
              projectName={liveQuiz.projectName}
              quizTitle={liveQuiz.title}
              title={shown ? 'Leaderboard on screen' : 'Question 3 ended'}
              description={
                shown
                  ? 'Participants see the top 10. Hide it, or select the next question when you are ready.'
                  : 'Participants now see the correct answer and their own result. Choose the next question when you are ready.'
              }
              status={shown ? 'Showing leaderboard' : 'Idle between questions'}
              connected={liveCounts.connected}
              registered={liveCounts.registered}
              asked={asked}
              questionCount={liveQuiz.questionCount}
            />
          }
          queue={
            <QuestionQueue
              questions={idleQueue}
              defaultDurationSeconds={liveQuiz.defaultDurationSeconds}
            />
          }
          main={
            <HostLeaderboardView board={previewLeaderboard} shown={shown} />
          }
          rail={
            <HostRail
              asked={asked}
              questionLive={false}
              leaderboardShown={shown}
            />
          }
        />
      </LiveSessionShell>
    );
  }
  if (
    screen === 'participant-leaderboard-top' ||
    screen === 'participant-leaderboard-outside'
  ) {
    const inside = screen === 'participant-leaderboard-top';
    return (
      <LiveSessionShell>
        <ParticipantLeaderboard
          board={previewLeaderboard}
          participantId={inside ? previewParticipantId : 'user-outside'}
          standing={{
            askedQuestionId: 'asked-3',
            totalScore: inside ? 4120 : 3240,
            rank: inside ? 8 : 18,
            participantCount: 500,
          }}
        />
      </LiveSessionShell>
    );
  }
  const participant = participantPreviews[screen];
  if (participant) {
    const { fixture, ...props } = participant;
    return (
      <LiveSessionShell>
        <ParticipantQuestionView question={fixture.question} {...props} />
      </LiveSessionShell>
    );
  }
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
            stats={{ score: 850, asked: 3, connected: 48 }}
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
    default:
      return null;
  }
}
