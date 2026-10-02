import { Check, Medal, Minus, Star, X } from 'lucide-react';
import type { ParticipantFinalResultDto } from '@quizmb/contracts';
import { Text } from '@/components/ui';
import { cn } from '@/lib/utils';
import { StatTile } from '@/features/live-session/stat-tile';

// The one presentation of a participant's final result, shared by the live
// end screen, the history summary and the history cards.

/** Final score and rank, side by side (stacked on phones). */
export function FinalScoreTiles({
  result,
}: {
  result: ParticipantFinalResultDto;
}) {
  return (
    <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
      <StatTile
        label="Final score"
        icon={<Star size={20} />}
        value={result.totalScore.toLocaleString()}
        suffix="pts"
      />
      <StatTile
        label="Final rank"
        icon={<Medal size={20} />}
        value={`#${result.rank}`}
        suffix={`of ${result.participantCount.toLocaleString()}`}
      />
    </div>
  );
}

const outcomes = [
  {
    key: 'correctCount',
    label: 'Correct',
    icon: Check,
    mark: 'bg-status-live-surface text-status-live-text',
    bar: 'bg-accent',
  },
  {
    key: 'incorrectCount',
    label: 'Incorrect',
    icon: X,
    mark: 'bg-danger-surface text-danger-on-surface',
    bar: 'bg-danger',
  },
  {
    key: 'notAttemptedCount',
    label: 'Not attempted',
    icon: Minus,
    mark: 'bg-surface-high text-text-secondary',
    bar: 'bg-surface-dim',
  },
] as const;

/**
 * Correct / incorrect / not-attempted over the scored questions the host
 * asked (descriptive questions are not counted).
 */
export function AnswerOutcomes({
  result,
}: {
  result: ParticipantFinalResultDto;
}) {
  const total =
    result.correctCount + result.incorrectCount + result.notAttemptedCount;
  if (total === 0)
    return (
      <Text variant="body-secondary" tone="secondary">
        No scored questions were asked in this quiz.
      </Text>
    );
  return (
    <div className="flex flex-col gap-space-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-space-xs">
        <Text as="h2" variant="label">
          Question outcomes
        </Text>
        <Text variant="caption" tone="secondary">
          {total} scored {total === 1 ? 'question' : 'questions'} asked
        </Text>
      </div>
      <div
        aria-hidden="true"
        className="flex h-space-xs w-full gap-0.5 overflow-hidden rounded-pill"
      >
        {outcomes.map(({ key, bar }) =>
          result[key] > 0 ? (
            <span
              key={key}
              className={bar}
              style={{ width: `${(result[key] / total) * 100}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="grid grid-cols-3 gap-space-xs sm:gap-space-sm">
        {outcomes.map(({ key, label, icon: Icon, mark }) => (
          <li
            key={key}
            className="flex flex-col items-center gap-1 rounded-control bg-surface-low p-space-sm text-center sm:flex-row sm:gap-space-sm sm:text-left"
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-pill',
                mark,
              )}
            >
              <Icon size={16} />
            </span>
            <span>
              <Text as="span" variant="section-heading" className="block">
                {result[key]}
              </Text>
              <Text as="span" variant="caption" tone="secondary">
                {label}
              </Text>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Compact one-line outcome counts for cards. */
export function OutcomeLine({ result }: { result: ParticipantFinalResultDto }) {
  return (
    <Text
      variant="caption"
      tone="secondary"
      className="flex flex-wrap items-center gap-x-space-sm gap-y-1"
    >
      {outcomes.map(({ key, label, bar }) => (
        <span key={key} className="inline-flex items-center gap-1">
          <span
            aria-hidden="true"
            className={cn('size-status-dot rounded-pill', bar)}
          />
          {result[key]} {label.toLowerCase()}
        </span>
      ))}
    </Text>
  );
}
