import {
  CalendarDays,
  ChevronRight,
  CircleCheck,
  Clock3,
  DoorClosed,
  Info,
  Layers,
  Play,
  Radio,
  UserCheck,
  UsersRound,
} from 'lucide-react';
import { Badge, ProgressBar, Surface, Text } from '@/components/ui';
import { CopyLinkButton } from '@/components/copy-link-button';
import { APP_LINKS } from '@/config/navigation';
import { ActionButton } from './action-button';
import { LateJoinToggle } from './late-join-toggle';
import { ParticipantRoster } from './participant-roster';
import { StatTile } from './stat-tile';
import type { LiveParticipant, LiveQuizSummary } from './types';

const startNotes = [
  'Starting closes registration and locks questions for this quiz.',
  'Participants move to the live stage; you choose the first question next.',
  'Questions never autoplay. Each timer starts only when you ask it.',
];

export function HostLobby({
  quiz,
  roster,
  connected,
  registered,
  publicUrl,
  allowLateJoin,
  onStartQuiz,
  onCloseLobby,
  onLateJoinChange,
  busy = false,
}: {
  quiz: LiveQuizSummary;
  roster: LiveParticipant[];
  connected: number;
  registered: number;
  publicUrl: string;
  allowLateJoin: boolean;
  onStartQuiz?: (() => void) | undefined;
  /** Cancels the unstarted lobby; the quiz stays published. */
  onCloseLobby?: (() => void) | undefined;
  onLateJoinChange?: ((allowed: boolean) => void) | undefined;
  /** True while a host command is awaiting the server. */
  busy?: boolean;
}) {
  const offline = registered - connected;
  const connectedShare =
    registered > 0 ? Math.round((connected / registered) * 1000) / 10 : 0;

  return (
    <div className="mx-auto w-full max-w-content space-y-space-lg px-margin-sm py-space-md md:px-margin lg:px-margin-lg lg:py-space-xl">
      <div className="flex flex-col justify-between gap-space-sm pb-space-xs sm:flex-row sm:items-center">
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-space-xs text-caption text-text-secondary">
            <li>Quizzes</li>
            <li aria-hidden="true">
              <ChevronRight size={14} />
            </li>
            <li className="font-semibold text-text-primary">Manage quiz</li>
            <li aria-hidden="true">
              <ChevronRight size={14} />
            </li>
            <li aria-current="page" className="font-medium text-accent">
              Host lobby
            </li>
          </ol>
        </nav>
        <Badge variant="live" label="Lobby open" className="self-start" />
      </div>

      <section className="relative isolate overflow-hidden rounded-card bg-surface-low p-space-md shadow-card lg:p-space-lg">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -bottom-24 -z-10 size-80 rounded-pill bg-action-secondary blur-3xl"
        />
        <div className="flex flex-col justify-between gap-space-md lg:flex-row lg:items-end">
          <div className="max-w-2xl space-y-space-xs">
            <Text
              variant="label"
              tone="secondary"
              className="flex items-center gap-space-xs tracking-widest uppercase"
            >
              <Layers size={16} aria-hidden="true" className="text-accent" />
              {quiz.projectName}
            </Text>
            <Text as="h1" variant="page-title">
              {quiz.title}
            </Text>
            <ul className="flex flex-wrap items-center gap-x-space-sm gap-y-1 pt-1 text-body-secondary text-text-secondary">
              <li className="inline-flex items-center gap-1.5">
                <CalendarDays size={16} aria-hidden="true" />
                {quiz.plannedDate}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <Clock3 size={16} aria-hidden="true" />
                {quiz.plannedTime}
              </li>
              <li className="inline-flex items-center gap-1.5">
                <UsersRound size={16} aria-hidden="true" />
                Host: {quiz.hostName}
              </li>
            </ul>
          </div>
          <CopyLinkButton
            url={publicUrl}
            label="Copy quiz link"
            variant="outline"
            className="self-start border-transparent shadow-card lg:self-auto"
          />
        </div>
      </section>

      <div className="grid grid-cols-1 gap-gutter-sm md:grid-cols-2 md:gap-gutter lg:grid-cols-12">
        <StatTile
          className="lg:col-span-4"
          label="Present in lobby"
          value={connected}
          suffix={`/ ${registered} registered`}
          icon={<Radio size={22} />}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between text-caption text-text-secondary">
              <span>Connected</span>
              <span className="font-semibold text-accent">
                {connectedShare}%
              </span>
            </div>
            <ProgressBar
              value={connected}
              max={registered}
              label="Registered participants connected"
            />
            <Text variant="caption" tone="secondary">
              {connected} participants are connected and waiting.
            </Text>
          </div>
        </StatTile>

        <StatTile
          className="lg:col-span-3"
          label="Registered total"
          value={registered}
          icon={<UserCheck size={20} />}
        >
          <Text
            variant="caption"
            tone="secondary"
            className="flex items-center gap-1.5"
          >
            <span
              aria-hidden="true"
              className="size-2 rounded-pill bg-border-control"
            />
            {offline} registered participants not connected yet
          </Text>
          <Text variant="caption" tone="secondary" className="pt-1">
            Registration limit: {quiz.registrationLimit}
          </Text>
        </StatTile>

        <section className="relative isolate flex flex-col justify-between gap-space-sm overflow-hidden rounded-card bg-action-primary p-space-md text-text-inverse shadow-raised md:col-span-2 lg:col-span-5">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-16 -right-16 -z-10 size-44 rounded-pill bg-accent opacity-40 blur-2xl"
          />
          <div className="space-y-space-xs">
            <Text
              variant="label"
              className="tracking-widest text-action-secondary uppercase"
            >
              Host control
            </Text>
            <Text as="h2" variant="card-title" tone="inverse">
              Start the quiz
            </Text>
            <Text variant="caption" tone="inverse">
              Starting moves everyone to the live stage. You will pick the first
              question from your console.
            </Text>
          </div>
          <div className="space-y-space-xs">
            <ActionButton
              onAction={onStartQuiz}
              preview="Starting the quiz"
              disabled={busy}
              variant="outline"
              className="h-control-large w-full border-transparent text-card-title text-action-primary"
              icon={<Play size={20} aria-hidden="true" />}
            >
              Start quiz now
            </ActionButton>
            <Text
              variant="caption"
              className="flex flex-wrap justify-between gap-space-xs px-1 text-action-secondary"
            >
              <span>{quiz.questionCount} questions ready</span>
              <span>
                {quiz.defaultDurationSeconds}s default timer per question
              </span>
            </Text>
            <ActionButton
              onAction={onCloseLobby}
              preview="Closing the lobby"
              disabled={busy}
              variant="ghost"
              className="w-full text-action-secondary enabled:hover:bg-action-primary-hover enabled:hover:text-action-on-primary"
              icon={<DoorClosed size={18} aria-hidden="true" />}
            >
              Close lobby without starting
            </ActionButton>
          </div>
        </section>
      </div>

      <Surface>
        <LateJoinToggle
          layout="banner"
          initialAllowed={allowLateJoin}
          onAllowedChange={onLateJoinChange}
          disabled={busy}
          description="Let registered participants join after the quiz starts. They enter the current question with only its remaining time."
        />
      </Surface>

      <div className="grid grid-cols-1 items-start gap-gutter-sm md:gap-gutter lg:grid-cols-12">
        <ParticipantRoster
          participants={roster}
          registered={registered}
          connected={connected}
          rosterHref={APP_LINKS.WORKSPACE.MANAGE_QUIZ(quiz.id)}
        />

        <div className="space-y-space-md lg:col-span-4">
          <Surface
            as="section"
            className="space-y-space-sm border-transparent bg-surface-low"
          >
            <Text
              as="h2"
              variant="caption"
              tone="secondary"
              className="font-semibold tracking-wider uppercase"
            >
              Session settings
            </Text>
            <dl className="divide-y divide-border-surface text-caption text-text-secondary">
              {[
                ['Questions', `${quiz.questionCount} questions`],
                ['Default timer', `${quiz.defaultDurationSeconds}s / question`],
                ['Question order', 'Chosen live by you'],
                ['Leaderboard', 'Shown only when you choose'],
              ].map(([term, value]) => (
                <div
                  key={term}
                  className="flex justify-between gap-space-sm py-space-xs"
                >
                  <dt>{term}</dt>
                  <dd className="text-right font-medium text-text-primary">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
          </Surface>

          <Surface as="section" className="space-y-space-xs">
            <Text
              as="h2"
              variant="label"
              className="flex items-center gap-space-xs tracking-wider text-accent uppercase"
            >
              <Info size={20} aria-hidden="true" />
              Before you start
            </Text>
            <ul className="space-y-2 pt-1 text-body-secondary text-text-secondary">
              {startNotes.map((note) => (
                <li key={note} className="flex items-start gap-space-xs">
                  <CircleCheck
                    size={16}
                    aria-hidden="true"
                    className="mt-0.5 shrink-0 text-accent"
                  />
                  {note}
                </li>
              ))}
            </ul>
          </Surface>
        </div>
      </div>
    </div>
  );
}
