import { Timer } from 'lucide-react';
import { Text } from '@/components/ui';
import { cn } from '@/lib/utils';
import { optionLetter } from './format';

/** Lettered marker shared by host previews and live answer breakdowns. */
export function OptionLetter({
  index,
  emphasized = false,
}: {
  index: number;
  emphasized?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-sm text-label',
        emphasized
          ? 'bg-action-primary text-action-on-primary'
          : 'bg-surface-highest text-text-primary',
      )}
    >
      {optionLetter(index)}
    </span>
  );
}

/** Small rectangular question metadata chip. */
export function QuestionChip({
  children,
  tone = 'neutral',
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'strong' | 'live';
}) {
  return (
    <Text
      as="span"
      variant="caption"
      className={cn(
        'inline-flex items-center gap-1 rounded-sm px-2.5 py-1 font-semibold',
        tone === 'neutral' && 'bg-surface-high text-text-secondary',
        tone === 'strong' && 'bg-action-primary text-action-on-primary',
        tone === 'live' && 'bg-status-live-surface text-status-live-text',
      )}
    >
      {children}
    </Text>
  );
}

/** Server-timer countdown display; turns urgent in the final ten seconds. */
export function TimerPill({
  remainingSeconds,
  durationSeconds,
}: {
  remainingSeconds: number;
  durationSeconds: number;
}) {
  const urgent = remainingSeconds <= 10;
  const circumference = 2 * Math.PI * 15.9155;
  return (
    <span
      role="timer"
      aria-live="off"
      className={cn(
        'inline-flex items-center gap-2 rounded-pill px-3 py-1.5',
        urgent
          ? 'bg-danger-surface text-danger-on-surface'
          : 'bg-surface-low text-text-primary',
      )}
    >
      <svg aria-hidden="true" viewBox="0 0 36 36" className="size-6 -rotate-90">
        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          strokeWidth="3"
          className={urgent ? 'stroke-danger-surface' : 'stroke-surface-high'}
        />
        <circle
          cx="18"
          cy="18"
          r="15.9155"
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={
            circumference * (1 - remainingSeconds / durationSeconds)
          }
          className={urgent ? 'stroke-danger' : 'stroke-accent'}
        />
      </svg>
      <span className="text-label font-bold">
        {remainingSeconds}s remaining
      </span>
    </span>
  );
}

export function DurationLabel({ seconds }: { seconds: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Timer size={14} aria-hidden="true" />
      {seconds}s
    </span>
  );
}
