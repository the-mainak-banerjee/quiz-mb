import type { CSSProperties, ReactNode } from 'react';
import { Check, Eye } from 'lucide-react';
import { Text } from '@/components/ui';
import {
  OptionLetter,
  QuestionChip,
  TimerPill,
} from '@/features/live-session/question-parts';
import { cn } from '@/lib/utils';

/*
 * Product fragments for the landing page: the real QuizMB UI pieces
 * (option letters, chips, timer) arranged with sample data. Purely
 * illustrative, so they are hidden from assistive technology; each card's
 * caption says what it shows.
 */

const delay = (seconds: number): CSSProperties => ({
  animationDelay: `${seconds}s`,
});

/** A minimal browser window around a product screen. */
export function BrowserFrame({
  url,
  children,
  className,
  decorative = true,
}: {
  url: string;
  children: ReactNode;
  className?: string;
  /** False when the content is a real screenshot with its own alt text. */
  decorative?: boolean;
}) {
  return (
    <div
      aria-hidden={decorative || undefined}
      className={cn(
        'overflow-hidden rounded-feature border border-border-surface bg-surface shadow-floating',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="flex items-center gap-space-sm border-b border-border-surface bg-surface-low px-space-sm py-2.5"
      >
        <div className="flex gap-1.5">
          {[0, 1, 2].map((dot) => (
            <span key={dot} className="size-2.5 rounded-pill bg-surface-dim" />
          ))}
        </div>
        <span className="mx-auto min-w-0 truncate rounded-pill bg-surface px-space-sm py-0.5 text-caption text-text-secondary">
          {url}
        </span>
        <span className="w-10" />
      </div>
      {children}
    </div>
  );
}

const BREAKDOWN = [
  { text: 'useMemo', percent: 18 },
  { text: 'useRef', percent: 64, correct: true },
  { text: 'useEffect', percent: 12 },
  { text: 'useId', percent: 6 },
];

/** The host's live answer breakdown: what landed and what did not. */
export function AnswerBreakdownMock() {
  return (
    <div aria-hidden="true" className="space-y-space-sm">
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <div className="flex items-center gap-space-xs">
          <QuestionChip tone="strong">Question 3 of 8</QuestionChip>
          <QuestionChip>Single choice</QuestionChip>
        </div>
        <TimerPill remainingSeconds={14} durationSeconds={30} />
      </div>
      <Text variant="section-heading">
        Which hook keeps a value between renders without re-rendering?
      </Text>
      <ul className="flex flex-col gap-space-xs">
        {BREAKDOWN.map((option, index) => (
          <li
            key={option.text}
            className={cn(
              'relative isolate overflow-hidden rounded-control px-3 py-2.5',
              option.correct
                ? 'bg-status-live-surface shadow-card'
                : 'bg-surface-low',
            )}
          >
            <span
              className={cn(
                'lp-fill absolute inset-y-0 left-0 -z-10',
                option.correct
                  ? 'bg-action-secondary-hover'
                  : 'bg-surface-high',
              )}
              style={{ width: `${option.percent}%`, ...delay(index * 0.15) }}
            />
            <div className="flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <OptionLetter
                  index={index}
                  emphasized={option.correct === true}
                />
                <Text
                  as="span"
                  className={cn(option.correct && 'font-semibold')}
                >
                  {option.text}
                </Text>
                {option.correct && (
                  <Check
                    size={16}
                    className="shrink-0 text-accent"
                    aria-hidden="true"
                  />
                )}
              </div>
              <Text as="span" variant="label" className="font-bold">
                {option.percent}%
              </Text>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-space-xs">
        <Text
          as="span"
          variant="caption"
          tone="secondary"
          className="inline-flex items-center gap-1"
        >
          <Eye size={14} aria-hidden="true" />
          Host only until the timer ends
        </Text>
        <Text as="span" variant="caption" className="font-semibold text-accent">
          22 of 24 answered
        </Text>
      </div>
    </div>
  );
}

/** Deterministic QR-like pattern; decorative, it encodes nothing. */
export function QrPattern({ className }: { className?: string }) {
  const size = 21;
  const cells: ReactNode[] = [];
  const finder = (x: number, y: number) =>
    x < 7 && y < 7
      ? 0
      : x >= size - 7 && y < 7
        ? 1
        : x < 7 && y >= size - 7
          ? 2
          : -1;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      if (finder(x, y) !== -1) continue;
      // A small integer hash: irregular, but the same on every render.
      const hash = Math.imul(x * 374761393 + y * 668265263, 1274126177);
      if (((hash >>> 13) & 7) < 3)
        cells.push(<rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" />);
    }
  const eye = (x: number, y: number) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" rx="1.5" />
      <rect
        x={x + 1}
        y={y + 1}
        width="5"
        height="5"
        rx="1"
        className="fill-surface"
      />
      <rect x={x + 2} y={y + 2} width="3" height="3" rx="0.6" />
    </g>
  );
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={cn('fill-action-primary', className)}
      shapeRendering="crispEdges"
    >
      {cells}
      {eye(0, 0)}
      {eye(size - 7, 0)}
      {eye(0, size - 7)}
    </svg>
  );
}
