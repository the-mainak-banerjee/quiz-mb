import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type BadgeProps = Omit<ComponentProps<'span'>, 'children'> & {
  variant: 'live' | 'scheduled' | 'draft' | 'completed';
  /** Contextual wording for the existing status, e.g. Live Ready. */
  label?: string;
};
const variants = {
  live: {
    label: 'Live Now',
    style: 'bg-status-live-surface text-status-live-text',
  },
  scheduled: {
    label: 'Scheduled',
    style: 'bg-status-scheduled-surface text-status-scheduled-text',
  },
  draft: {
    label: 'Draft',
    style: 'bg-status-neutral-surface text-status-neutral-text',
  },
  completed: {
    label: 'Completed',
    style: 'bg-danger-surface text-danger-on-surface',
  },
};

export function Badge({
  variant,
  label: customLabel,
  className,
  ...props
}: BadgeProps) {
  const { label, style } = variants[variant];
  return (
    <span
      {...props}
      className={cn(
        'inline-flex items-center gap-space-xs rounded-pill px-badge-x py-badge-y text-badge',
        style,
        className,
      )}
    >
      {variant === 'live' && (
        <span
          aria-hidden="true"
          className="ds-live-dot size-status-dot rounded-pill bg-current"
        />
      )}
      {customLabel ?? label}
    </span>
  );
}
