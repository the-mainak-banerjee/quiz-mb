import { NavigationGuardLink } from 'nextjs-nav-guard';
import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import { Brand } from '@/components/brand';
import { Badge } from '@/components/ui';
import { APP_LINKS } from '@/config/navigation';
import { PreviewProvider } from '@/contexts/preview-context';
import { cn } from '@/lib/utils';

/** Focused chrome for host and participant live screens. */
export function LiveSessionShell({
  exitHref = APP_LINKS.WORKSPACE.DASHBOARD,
  children,
  className,
}: {
  exitHref?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <PreviewProvider>
      <div className="flex min-h-screen flex-col bg-canvas">
        <header className="sticky top-0 z-30 border-b border-border-surface bg-canvas/95 backdrop-blur-sm">
          <div className="mx-auto grid h-14 max-w-content grid-cols-[1fr_auto_1fr] items-center gap-space-xs sm:gap-space-sm px-margin-sm md:px-margin lg:px-margin-lg">
            {/* Not a link: Exit is the only way out of a live session. */}
            <span className="justify-self-start [&_svg]:h-space-md sm:[&_svg]:h-space-lg">
              <Brand />
            </span>
            <Badge variant="live" label="Live session" className="uppercase" />
            {/* Guarded: the host console may confirm before leaving. */}
            <NavigationGuardLink
              href={exitHref}
              className="ds-focus ds-control-motion inline-flex items-center gap-1 justify-self-end rounded-control px-space-xs py-1.5 sm:px-3 text-caption text-danger hover:bg-danger-surface hover:text-danger-on-surface"
            >
              <X size={18} aria-hidden="true" />
              Exit
            </NavigationGuardLink>
          </div>
        </header>
        <main
          className={cn(
            'relative isolate flex flex-1 flex-col overflow-x-clip',
            className,
          )}
        >
          {children}
        </main>
      </div>
    </PreviewProvider>
  );
}

/** Decorative soft glows used behind focused live screens. */
export function AmbientGlow({
  placement,
}: {
  placement: 'top-left' | 'top-center' | 'bottom-right';
}) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none absolute -z-10 size-96 rounded-pill bg-action-secondary blur-3xl',
        placement === 'top-left' && '-top-32 -left-20',
        placement === 'top-center' && '-top-12 left-1/2 -translate-x-1/2',
        placement === 'bottom-right' && '-right-16 -bottom-24 bg-surface-high',
      )}
    />
  );
}
