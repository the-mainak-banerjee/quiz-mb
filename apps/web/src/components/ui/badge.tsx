import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type BadgeProps = Omit<ComponentProps<'span'>, 'children'> & {
  variant: 'live' | 'scheduled' | 'draft' | 'completed' | 'danger';
  /** Contextual wording for the existing status, e.g. Live Ready. */
  label?: ReactNode;
  /** Leading status dot. Live and danger show a pulsing dot by default. */
  dot?: boolean;
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
  danger: {
    label: 'Attention',
    style: 'bg-danger-surface text-danger-on-surface',
  },
};

export function Badge({
  variant,
  label: customLabel,
  dot = variant === 'live' || variant === 'danger',
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
      {dot && (
        <span
          aria-hidden="true"
          className={cn(
            'size-status-dot shrink-0 rounded-pill bg-current',
            (variant === 'live' || variant === 'danger') && 'ds-live-dot',
          )}
        />
      )}
      {customLabel ?? label}
    </span>
  );
}
