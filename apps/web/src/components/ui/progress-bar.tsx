import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type ProgressBarProps = Omit<ComponentProps<'div'>, 'children'> & {
  value: number;
  max?: number;
  /** Accessible name, e.g. "Connected participants". */
  label: string;
};

export function ProgressBar({
  value,
  max = 100,
  label,
  className,
  ...props
}: ProgressBarProps) {
  const percent = max > 0 ? Math.min(Math.max(value / max, 0), 1) * 100 : 0;
  return (
    <div
      {...props}
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn(
        'h-space-xs w-full overflow-hidden rounded-pill bg-surface-high',
        className,
      )}
    >
      <div
        className="h-full rounded-pill bg-accent"
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}
