import {
  ArrowLeft,
  ArrowRight,
  Cast,
  Layers,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Avatar, Badge, ProgressBar, Surface, Text } from '@/components/ui';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { AmbientGlow } from './live-session-shell';
import { StatTile } from './stat-tile';
import type { LiveParticipant } from './types';

/** Shown when a host tries to open a lobby while another quiz is live. */
export function HostLiveConflict({
  activeQuizTitle,
  activeProjectName,
  startedLabel,
  stageLabel,
  connected,
  registered,
  asked,
  questionCount,
  waiting,
  returnHref,
  backHref,
}: {
  activeQuizTitle: string;
  activeProjectName: string;
  startedLabel: string;
  stageLabel: string;
  connected: number;
  registered: number;
  asked: number;
  questionCount: number;
  waiting: LiveParticipant[];
  returnHref: string;
  backHref: string;
}) {
  const shown = waiting.slice(0, 3);
  return (
    <main className="relative isolate flex flex-1 flex-col items-center justify-center overflow-x-clip px-margin-sm py-space-xl lg:px-margin-lg">
      <AmbientGlow placement="top-left" />
      <AmbientGlow placement="bottom-right" />

      <Surface className="flex w-full max-w-3xl flex-col gap-space-lg shadow-floating sm:p-space-xl">
        <div className="flex flex-col justify-between gap-space-sm sm:flex-row sm:items-center">
          <Badge
            variant="danger"
            label="Live quiz already running"
            className="self-start uppercase"
          />
          <Text
            variant="caption"
            tone="secondary"
            className="flex items-center gap-space-xs"
          >
            <ShieldCheck size={16} aria-hidden="true" className="text-accent" />
            One live quiz per host
          </Text>
        </div>

        <div className="flex flex-col gap-space-xs">
          <Text
            variant="label"
            className="tracking-widest text-accent uppercase"
          >
            Active session detected
          </Text>
          <Text as="h1" variant="page-title">
            You already have an active live quiz in progress
          </Text>
          <Text tone="secondary" className="max-w-2xl pt-1">
            QuizMB runs one live quiz per host at a time. Return to your live
            quiz, or end it from its host console before opening another lobby.
          </Text>
        </div>

        <section className="flex w-full flex-col gap-space-md rounded-card bg-surface-low p-space-md sm:p-space-lg">
          <div className="flex flex-col justify-between gap-space-sm sm:flex-row sm:items-start">
            <div className="flex min-w-0 items-start gap-space-sm">
              <span
                aria-hidden="true"
                className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-control bg-surface text-accent shadow-card"
              >
                <Cast size={24} />
              </span>
              <div className="min-w-0">
                <Text
                  variant="caption"
                  tone="secondary"
                  className="font-semibold tracking-wider uppercase"
                >
                  Current live quiz
                </Text>
                <Text as="h2" variant="card-title" className="truncate">
                  {activeQuizTitle}
                </Text>
                <Text variant="caption" tone="secondary" className="pt-1">
                  {activeProjectName} · {startedLabel}
                </Text>
              </div>
            </div>
            <Badge variant="live" label={stageLabel} className="self-start" />
          </div>

          <div className="grid grid-cols-1 gap-space-xs pt-2 sm:grid-cols-3">
            <StatTile
              size="compact"
              label="Connected"
              value={connected}
              suffix={`/ ${registered} registered`}
              icon={<UsersRound size={16} />}
            >
              <ProgressBar
                value={connected}
                max={registered}
                label="Registered participants connected"
                className="h-1.5"
              />
            </StatTile>
            <StatTile
              size="compact"
              label="Questions asked"
              value={asked}
              suffix={`of ${questionCount}`}
              icon={<Layers size={16} />}
            >
              <Text variant="caption" tone="secondary">
                {questionCount - asked} remaining
              </Text>
            </StatTile>
            <StatTile
              size="compact"
              label="Current stage"
              value={stageLabel}
              icon={<Cast size={16} />}
            >
              <Text variant="caption" tone="secondary">
                Waiting for your next action
              </Text>
            </StatTile>
          </div>
        </section>

        <div className="flex flex-col items-stretch gap-space-sm pt-2 sm:flex-row sm:items-center">
          <NavigationItem
            href={returnHref}
            icon={<ArrowRight size={18} aria-hidden="true" />}
            iconPosition="right"
            className="ds-primary-motion min-h-control-large flex-1 bg-action-primary text-action-on-primary shadow-raised hover:bg-action-primary-hover hover:text-action-on-primary"
          >
            Return to live quiz
          </NavigationItem>
          <NavigationItem
            href={backHref}
            icon={<ArrowLeft size={18} aria-hidden="true" />}
            className="min-h-control-large bg-surface-high text-text-secondary hover:bg-surface-muted"
          >
            Back to quiz
          </NavigationItem>
        </div>
      </Surface>

      <div className="mt-space-lg flex flex-wrap items-center justify-center gap-space-sm text-caption text-text-secondary">
        <span>In your live quiz:</span>
        <div className="flex items-center -space-x-2">
          {shown.map((participant) => (
            <Avatar
              key={participant.id}
              name={participant.name}
              size="small"
              className="ring-2 ring-canvas"
            />
          ))}
          <span className="flex size-7 items-center justify-center rounded-pill bg-surface-highest text-caption font-semibold text-text-secondary ring-2 ring-canvas">
            +{connected - shown.length}
          </span>
        </div>
        <span>participants waiting for you</span>
      </div>
    </main>
  );
}
