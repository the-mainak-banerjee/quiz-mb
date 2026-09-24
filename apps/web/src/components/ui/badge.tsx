import type { ComponentProps } from 'react';

export type BadgeProps = Omit<ComponentProps<'span'>, 'children'> & {
  variant: 'live' | 'scheduled' | 'draft' | 'completed';
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
    style: 'bg-status-neutral-surface text-status-neutral-text',
  },
};

export function Badge({ variant, className = '', ...props }: BadgeProps) {
  const { label, style } = variants[variant];
  return (
    <span
      {...props}
      className={`inline-flex items-center gap-space-xs rounded-pill px-badge-x py-badge-y text-badge ${style} ${className}`}
    >
      {variant === 'live' && (
        <span
          aria-hidden="true"
          className="ds-live-dot size-status-dot rounded-pill bg-current"
        />
      )}
      {label}
    </span>
  );
}
