import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

/** A small plus where two landing frame lines meet. */
export function FrameCorner({ className }: { className: string }) {
  return (
    <Plus
      size={14}
      strokeWidth={1.5}
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute text-text-secondary/60',
        className,
      )}
    />
  );
}

/** Thin frame extensions fade away above or below their container. */
export function FadingFrameSides({ direction }: { direction: 'up' | 'down' }) {
  const fade =
    direction === 'up'
      ? 'bg-linear-to-t from-border-surface to-transparent'
      : 'bg-linear-to-b from-border-surface to-transparent';

  return (
    <>
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 left-0 w-px',
          fade,
        )}
      />
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0 w-px',
          fade,
        )}
      />
    </>
  );
}

/** The cards' resting grid and glow, brightening on group hover. */
export function FrameHoverBackground() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
    >
      <div className="lp-grid-card absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-100" />
      <div className="absolute -top-24 left-1/2 h-56 w-[120%] -translate-x-1/2 rounded-pill bg-status-live-surface opacity-50 blur-3xl transition-opacity duration-300 group-hover:opacity-100" />
    </div>
  );
}
