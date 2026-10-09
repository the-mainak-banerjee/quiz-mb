import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * The landing page card: a white surface carrying the hero's grid and soft
 * green glow, dimmed at rest and a little brighter on hover (with a slight
 * lift and a green-tinted border). Used for every card section.
 */
export function LandingCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={cn(
        'group relative isolate overflow-hidden rounded-feature border border-border-surface bg-surface shadow-card transition duration-300 ease-out hover:-translate-y-0.5 hover:border-accent-soft/40 hover:shadow-raised motion-reduce:transition-none motion-reduce:hover:translate-y-0',
        className,
      )}
    >
      <div
        aria-hidden="true"
        className="lp-grid-card pointer-events-none absolute inset-0 -z-10 opacity-40 transition-opacity duration-300 group-hover:opacity-100"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-56 w-[120%] -translate-x-1/2 rounded-pill bg-status-live-surface opacity-50 blur-3xl transition-opacity duration-300 group-hover:opacity-100"
      />
      {children}
    </article>
  );
}
