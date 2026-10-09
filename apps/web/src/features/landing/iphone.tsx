import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * A realistic phone for showcasing participant screens: side buttons
 * (action, volume, power), a rounded bezel, a status bar, a Dynamic Island
 * and a home indicator. On hover the island expands into a "Quiz live"
 * activity. The screen content keeps its own alt text.
 */
export function IPhone({
  children,
  className,
  onLight = false,
}: {
  children: ReactNode;
  className?: string;
  /** On a light page: graphite buttons and rim, so they still show. */
  onLight?: boolean;
}) {
  const button = onLight ? 'bg-text-secondary/60' : 'bg-text-inverse/30';
  return (
    <div className={cn('group relative w-64', className)}>
      {/* Side buttons. */}
      <span
        aria-hidden="true"
        className={`absolute -left-[3px] top-[18%] h-6 w-[3px] rounded-l-sm ${button}`}
      />
      <span
        aria-hidden="true"
        className={`absolute -left-[3px] top-[26%] h-11 w-[3px] rounded-l-sm ${button}`}
      />
      <span
        aria-hidden="true"
        className={`absolute -left-[3px] top-[36%] h-11 w-[3px] rounded-l-sm ${button}`}
      />
      <span
        aria-hidden="true"
        className={`absolute -right-[3px] top-[30%] h-16 w-[3px] rounded-r-sm ${button}`}
      />

      <div
        className={cn(
          'rounded-[2.9rem] bg-surface-inverse p-[9px] shadow-floating ring-2',
          onLight ? 'ring-text-secondary/40' : 'ring-text-inverse/20',
        )}
      >
        <div className="relative overflow-hidden rounded-[2.35rem] bg-canvas">
          {/* Status bar. */}
          <div
            aria-hidden="true"
            className="flex h-9 items-center justify-between px-6 text-[11px] font-semibold text-text-primary"
          >
            <span>11:11</span>
            <span className="flex items-center gap-1">
              <span className="flex items-end gap-px">
                {[3, 5, 7, 9].map((height) => (
                  <span
                    key={height}
                    className="w-[3px] rounded-sm bg-text-primary"
                    style={{ height }}
                  />
                ))}
              </span>
              <span className="ml-1 h-2.5 w-5 rounded-[3px] border border-text-primary p-px">
                <span className="block h-full w-3/4 rounded-[1px] bg-text-primary" />
              </span>
            </span>
          </div>

          {/* Dynamic Island: expands into a live activity on hover. */}
          <div
            aria-hidden="true"
            className="absolute left-1/2 top-2 z-10 flex h-6 w-20 -translate-x-1/2 items-center justify-end overflow-hidden rounded-pill bg-surface-inverse px-2 transition-[width,height] duration-500 ease-out group-hover:h-7 group-hover:w-32 motion-reduce:transition-none"
          >
            <span className="absolute left-3 flex items-center gap-1.5 whitespace-nowrap text-[10px] font-semibold text-text-inverse opacity-0 transition-opacity delay-150 duration-300 group-hover:opacity-100">
              <span className="ds-live-dot size-1.5 rounded-pill bg-accent-soft" />
              Quiz live
            </span>
            <span className="size-2.5 rounded-pill bg-text-primary ring-1 ring-text-inverse/20" />
          </div>

          <div className="aspect-[390/800] overflow-hidden">{children}</div>

          {/* Home indicator. */}
          <span
            aria-hidden="true"
            className="absolute bottom-2 left-1/2 h-1 w-24 -translate-x-1/2 rounded-pill bg-text-primary/80"
          />
        </div>
      </div>
    </div>
  );
}
