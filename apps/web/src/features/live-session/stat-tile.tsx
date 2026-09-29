import type { ReactNode } from 'react';
import { Surface, Text } from '@/components/ui';
import { cn } from '@/lib/utils';

/** Headline live metric with an optional icon and supporting footer. */
export function StatTile({
  label,
  value,
  suffix,
  icon,
  size = 'large',
  children,
  className,
}: {
  label: string;
  value: ReactNode;
  suffix?: ReactNode;
  icon?: ReactNode;
  size?: 'large' | 'compact';
  children?: ReactNode;
  className?: string;
}) {
  const large = size === 'large';
  return (
    <Surface
      className={cn(
        'flex flex-col justify-between',
        !large && 'rounded-control p-space-sm',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-space-sm">
        <div className="min-w-0 space-y-1">
          <Text
            variant="caption"
            tone="secondary"
            className={cn(large && 'font-semibold tracking-wider uppercase')}
          >
            {label}
          </Text>
          <p className="flex flex-wrap items-baseline gap-x-space-xs">
            <span
              className={cn(
                'text-text-primary',
                large ? 'text-display' : 'text-section-heading font-bold',
              )}
            >
              {value}
            </span>
            {suffix && (
              <Text as="span" variant="caption" tone="secondary">
                {suffix}
              </Text>
            )}
          </p>
        </div>
        {icon && (
          <span
            aria-hidden="true"
            className={cn(
              'flex shrink-0 items-center justify-center text-accent',
              large
                ? 'size-10 rounded-control bg-status-live-surface'
                : 'text-text-secondary',
            )}
          >
            {icon}
          </span>
        )}
      </div>
      {children && (
        <div className={cn(large ? 'pt-space-md' : 'pt-space-xs')}>
          {children}
        </div>
      )}
    </Surface>
  );
}
