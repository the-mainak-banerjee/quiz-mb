import type { ReactNode } from 'react';
import { Layers, UsersRound } from 'lucide-react';
import { Badge, Text } from '@/components/ui';

/** Page header for the host's live console. */
export function HostConsoleHeader({
  projectName,
  quizTitle,
  title,
  description,
  status,
  connected,
  registered,
  asked,
  questionCount,
}: {
  projectName: string;
  quizTitle: string;
  title: string;
  description: string;
  status: string;
  connected: number;
  registered: number;
  asked: number;
  questionCount: number;
}) {
  return (
    <header className="flex flex-col justify-between gap-space-sm border-b border-border-surface pb-space-md lg:flex-row lg:items-end">
      <div className="flex min-w-0 flex-col gap-1.5">
        <Text
          variant="caption"
          tone="secondary"
          className="flex flex-wrap items-center gap-x-space-xs tracking-wider uppercase"
        >
          <span>{projectName}</span>
          <span aria-hidden="true">/</span>
          <span className="font-semibold text-accent">{quizTitle}</span>
        </Text>
        <Badge variant="live" label={status} className="self-start" />
        <Text as="h1" variant="page-title">
          {title}
        </Text>
        <Text tone="secondary">{description}</Text>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Text
          as="span"
          variant="label"
          className="flex items-center gap-2 rounded-control border border-border-surface bg-surface-low px-3.5 py-2"
        >
          <UsersRound size={16} aria-hidden="true" className="text-accent" />
          {connected} connected
          <Text as="span" variant="caption" tone="secondary">
            / {registered} registered
          </Text>
        </Text>
        <Text
          as="span"
          variant="label"
          className="flex items-center gap-2 rounded-control border border-border-surface bg-surface-low px-3.5 py-2"
        >
          <Layers size={16} aria-hidden="true" className="text-accent" />
          {asked} of {questionCount} asked
          <Text as="span" variant="caption" tone="secondary">
            ({questionCount - asked} remaining)
          </Text>
        </Text>
      </div>
    </header>
  );
}

/**
 * Three-column host console: queue | main | controls on desktop. Stacked
 * screens always show main, then the queue, then the controls.
 */
export function HostConsoleLayout({
  header,
  queue,
  main,
  rail,
}: {
  header: ReactNode;
  queue: ReactNode;
  main: ReactNode;
  rail: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-content space-y-space-md px-margin-sm py-space-md md:px-margin lg:px-margin-lg">
      {header}
      <div className="grid grid-cols-1 items-start gap-gutter-sm pb-space-xl md:grid-cols-2 md:gap-gutter lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-space-md md:col-span-2 lg:order-2 lg:col-span-6">
          {main}
        </div>
        <div className="flex min-w-0 flex-col gap-space-sm lg:order-1 lg:col-span-3">
          {queue}
        </div>
        <div className="flex min-w-0 flex-col gap-space-sm lg:order-3 lg:col-span-3">
          {rail}
        </div>
      </div>
    </div>
  );
}
