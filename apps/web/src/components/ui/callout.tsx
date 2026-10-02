import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type CalloutProps = HTMLAttributes<HTMLDivElement> & {
  /** Decorative leading icon; mark it aria-hidden. */
  icon?: ReactNode;
};

/** Quiet tinted note for guidance or state explanations inside a card. */
export function Callout({ icon, className, children, ...props }: CalloutProps) {
  return (
    <div
      {...props}
      className={cn(
        'flex items-start gap-space-xs rounded-control bg-surface-low p-space-sm text-caption text-text-secondary',
        className,
      )}
    >
      {icon && <span className="mt-px shrink-0 text-accent">{icon}</span>}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
