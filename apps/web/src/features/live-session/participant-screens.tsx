import type { ReactNode } from 'react';
import {
  BookOpen,
  Lightbulb,
  LockKeyhole,
  Radio,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Avatar, Badge, Callout, Surface, Text } from '@/components/ui';
import { PreviewButton } from '@/components/workspace/preview-actions';
import { cn } from '@/lib/utils';
import { AmbientGlow } from './live-session-shell';
import type { LiveQuizSummary } from './types';

/** Centered stage shared by participant waiting and recovery screens. */
function ParticipantStage({
  children,
  glow,
  className,
}: {
  children: ReactNode;
  glow?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative mx-auto flex w-full max-w-content flex-1 flex-col items-center justify-center px-margin-sm py-space-xl md:px-margin lg:px-margin-lg',
        className,
      )}
    >
      {glow}
      {children}
    </div>
  );
}

/** Radar-style live mark used on participant waiting states. */
function LivePulse({ children }: { children: ReactNode }) {
  return (
    <div className="relative my-space-xs flex size-28 items-center justify-center">
      <span
        aria-hidden="true"
        className="ds-live-dot absolute inset-0 rounded-pill bg-status-live-surface"
      />
      <span
        aria-hidden="true"
        className="absolute inset-2 rounded-pill bg-action-secondary"
      />
      <div className="relative flex size-16 items-center justify-center rounded-pill bg-action-primary text-action-on-primary shadow-raised">
        {children}
      </div>
    </div>
  );
}

export function ParticipantLobby({
  quiz,
  connected,
}: {
  quiz: LiveQuizSummary;
  connected: number;
}) {
  const others = connected - 1;
  return (
    <ParticipantStage glow={<AmbientGlow placement="top-center" />}>
      <div className="flex w-full max-w-2xl flex-col items-center text-center">
        <Badge
          variant="live"
          label="Connected to live room"
          className="mb-space-md uppercase shadow-card"
        />
        <Text as="h1" variant="display" className="mb-space-xs">
          You&apos;re in the lobby
        </Text>
        <Text tone="secondary" className="mb-space-xl">
          Waiting for the host to start the quiz…
        </Text>

        <Surface className="w-full space-y-space-md text-left shadow-raised">
          <div className="flex items-center justify-between gap-space-sm">
            <div className="flex min-w-0 items-center gap-space-sm">
              <span
                aria-hidden="true"
                className="flex size-11 shrink-0 items-center justify-center rounded-control bg-surface-muted text-text-primary"
              >
                <BookOpen size={22} />
              </span>
              <div className="min-w-0">
                <Text
                  variant="caption"
                  tone="secondary"
                  className="tracking-wider uppercase"
                >
                  Quiz
                </Text>
                <Text as="h2" variant="card-title" className="truncate">
                  {quiz.title}
                </Text>
              </div>
            </div>
            <Badge
              variant="draft"
              label="Host controlled"
              className="hidden sm:inline-flex"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 rounded-control bg-surface-low p-space-sm">
            <Avatar
              name={quiz.hostName}
              size="large"
              tone="neutral"
              decorative
            />
            <div className="min-w-0 flex-1">
              <Text variant="card-title" className="truncate">
                {quiz.hostName}
              </Text>
              <Text variant="caption" tone="secondary">
                Host · {quiz.projectName}
              </Text>
            </div>
            <Badge
              variant="scheduled"
              label={`${quiz.plannedDate} · ${quiz.plannedTime}`}
            />
          </div>

          <div className="flex items-start gap-3 p-space-sm">
            <span
              aria-hidden="true"
              className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-pill bg-status-live-surface text-accent"
            >
              <UsersRound size={18} />
            </span>
            <Text>
              There are{' '}
              <strong className="font-semibold">{others} participants</strong>{' '}
              in the lobby with you. When the host starts the quiz, the room
              moves to the live stage before the first question is asked.
            </Text>
          </div>
        </Surface>

        <Text
          role="status"
          variant="caption"
          tone="secondary"
          className="mt-space-xl flex items-center gap-space-xs tracking-wide"
        >
          <RefreshCw
            size={16}
            aria-hidden="true"
            className="text-accent motion-safe:animate-spin"
          />
          Connected · the quiz starts when the host is ready
        </Text>
      </div>
    </ParticipantStage>
  );
}

export function ParticipantReconnecting({
  quiz,
  attempt,
  maxAttempts,
  score,
  asked,
  connected,
}: {
  quiz: LiveQuizSummary;
  attempt: number;
  maxAttempts: number;
  score: number;
  asked: number;
  connected: number;
}) {
  const circumference = 2 * Math.PI * 48;
  return (
    <ParticipantStage
      glow={
        <>
          <AmbientGlow placement="top-left" />
          <AmbientGlow placement="bottom-right" />
        </>
      }
    >
      <div className="flex w-full max-w-xl flex-col items-center">
        <Surface className="flex w-full flex-col items-center text-center shadow-floating sm:p-space-lg">
          <Badge
            variant="live"
            label="Restoring connection"
            className="mb-space-md uppercase"
          />
          <div className="relative my-space-xs flex size-28 items-center justify-center">
            <span
              aria-hidden="true"
              className="absolute inset-2 rounded-pill bg-status-live-surface"
            />
            <svg
              aria-hidden="true"
              viewBox="0 0 112 112"
              className="absolute inset-0 -rotate-90"
            >
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                strokeWidth="3"
                className="stroke-surface-high"
              />
              <circle
                cx="56"
                cy="56"
                r="48"
                fill="none"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - attempt / maxAttempts)}
                className="stroke-accent"
              />
            </svg>
            <div className="relative flex flex-col items-center">
              <Radio
                size={30}
                aria-hidden="true"
                className="ds-live-dot text-text-primary"
              />
              <Text
                as="span"
                variant="caption"
                tone="secondary"
                className="mt-0.5 font-semibold"
              >
                <span className="sr-only">Attempt </span>
                {attempt} / {maxAttempts}
              </Text>
            </div>
          </div>

          <div
            role="status"
            className="mt-space-sm mb-space-md max-w-md space-y-space-xs"
          >
            <Text as="h1" variant="page-title">
              Reconnecting to the live room…
            </Text>
            <Text tone="secondary">
              Hold tight while we reconnect you. You don&apos;t need to refresh
              this page.
            </Text>
          </div>

          <Callout
            className="mb-space-md w-full text-left"
            icon={
              <span className="flex rounded-sm bg-status-live-surface p-1">
                <ShieldCheck size={20} aria-hidden="true" />
              </span>
            }
          >
            <div className="flex flex-wrap items-center justify-between gap-x-space-xs">
              <Text as="span" variant="label">
                Your place is saved
              </Text>
              <Text as="span" variant="caption" className="text-accent">
                Registration kept
              </Text>
            </div>
            <Text variant="body-secondary" tone="secondary" className="mt-0.5">
              Your registration and any submitted answers are preserved. You
              will return to the current question automatically.
            </Text>
          </Callout>

          <div className="mb-space-md grid w-full grid-cols-1 gap-space-xs text-left sm:grid-cols-2">
            <div className="rounded-control bg-surface-muted p-3">
              <Text variant="caption" tone="secondary">
                Network status
              </Text>
              <Text variant="label" className="mt-1 flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="ds-live-dot size-status-dot rounded-pill bg-accent"
                />
                Retrying automatically
              </Text>
            </div>
            <div className="rounded-control bg-surface-muted p-3">
              <Text variant="caption" tone="secondary">
                Quiz
              </Text>
              <Text variant="label" className="mt-1 truncate">
                {quiz.title}
              </Text>
            </div>
          </div>

          <PreviewButton
            action="Reconnecting manually"
            className="w-full"
            icon={<RefreshCw size={18} aria-hidden="true" />}
          >
            Try reconnecting now
          </PreviewButton>
        </Surface>

        <dl className="mt-space-md grid w-full max-w-md grid-cols-3 gap-space-sm text-center">
          {[
            ['Your score', `${score.toLocaleString()} pts`],
            ['Questions asked', String(asked)],
            ['In room', `${connected} participants`],
          ].map(([term, value]) => (
            <div key={term} className="flex flex-col items-center">
              <dt className="text-caption tracking-wider text-text-secondary uppercase">
                {term}
              </dt>
              <dd className="mt-0.5 text-card-title text-text-primary">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </ParticipantStage>
  );
}

export function ParticipantLiveIdle({
  quiz,
  participantName,
}: {
  quiz: LiveQuizSummary;
  participantName: string;
}) {
  return (
    <ParticipantStage className="md:py-space-2xl">
      <Text
        variant="caption"
        tone="secondary"
        className="mb-space-sm flex flex-wrap items-center justify-center gap-space-xs tracking-widest uppercase"
      >
        <span>{quiz.projectName}</span>
        <span aria-hidden="true">•</span>
        <span className="text-accent">Live now</span>
      </Text>
      <div className="mb-space-xl max-w-xl text-center">
        <Text as="h1" variant="display" className="mb-2">
          The quiz is live
        </Text>
        <Text tone="secondary">Waiting for the first question…</Text>
      </div>

      <div className="flex w-full max-w-2xl flex-col gap-space-md">
        <Surface className="flex flex-col items-center text-center md:p-space-lg">
          <LivePulse>
            <Radio size={28} aria-hidden="true" />
          </LivePulse>
          <Badge
            variant="live"
            label="Live · connected"
            className="mb-space-md uppercase"
          />
          <Text as="h2" variant="card-title" className="mb-space-xs max-w-md">
            {quiz.hostName} (Host) is preparing the first question.
          </Text>
          <Text
            variant="body-secondary"
            tone="secondary"
            className="mb-space-md max-w-lg"
          >
            It appears on your screen automatically when the host asks it, and
            its timer starts right away.
          </Text>
          <div
            aria-hidden="true"
            className="mb-space-sm flex items-center justify-center gap-1.5 py-space-xs"
          >
            {['h-3', 'h-5', 'h-8', 'h-4', 'h-6', 'h-3'].map((height, index) => (
              <span
                key={index}
                className={cn(
                  'ds-live-dot w-1 rounded-pill',
                  height,
                  index === 2 || index === 4
                    ? 'bg-accent'
                    : 'bg-status-live-surface',
                )}
                style={{ animationDelay: `${index * 150}ms` }}
              />
            ))}
          </div>
          <div className="flex w-full flex-col items-center justify-between gap-space-xs rounded-control bg-surface-low p-space-sm text-left sm:flex-row">
            <Text variant="label" className="flex items-center gap-space-xs">
              <Avatar name={participantName} size="small" decorative />
              {participantName}
              <Text as="span" variant="body-secondary" tone="secondary">
                · Participant
              </Text>
            </Text>
            <Text
              variant="label"
              className="flex items-center gap-2 text-accent"
            >
              <span
                aria-hidden="true"
                className="size-status-dot rounded-pill bg-accent"
              />
              Connected
            </Text>
          </div>
        </Surface>

        <Surface className="flex items-start gap-space-sm border-transparent bg-surface-low">
          <span
            aria-hidden="true"
            className="mt-0.5 shrink-0 rounded-control bg-surface-highest p-2 text-accent"
          >
            <Lightbulb size={20} />
          </span>
          <div className="space-y-0.5">
            <Text variant="label" className="tracking-wider uppercase">
              Quick tip
            </Text>
            <Text variant="body-secondary" tone="secondary">
              Your answer locks as soon as you press Submit, and faster correct
              answers earn more points. An answer you select but don&apos;t
              submit won&apos;t count.
            </Text>
          </div>
        </Surface>

        <Text
          variant="caption"
          tone="secondary"
          className="flex items-center gap-1 px-space-xs"
        >
          <LockKeyhole size={14} aria-hidden="true" />
          Only the host controls when questions start.
        </Text>
      </div>
    </ParticipantStage>
  );
}
