import type { ReactNode } from 'react';
import { Text } from '@/components/ui/text';
import { cn } from '@/lib/utils';
import { Milo, type MiloPose } from './milo';

/** Milo on a soft brand glow, the shared stage for every Milo moment. */
export function MiloStage({
  pose,
  className,
}: {
  pose: MiloPose;
  className?: string;
}) {
  return (
    <div className={cn('relative grid place-items-center', className)}>
      <div
        aria-hidden="true"
        className="absolute inset-[12%] rounded-pill bg-status-live-surface blur-2xl"
      />
      <Milo pose={pose} className="relative w-full" />
    </div>
  );
}

/** Milo thinking, a label and a running progress line. */
export function MiloLoading({
  label = 'Loading…',
  hint,
}: {
  label?: string;
  hint?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="milo-enter flex flex-col items-center gap-space-sm text-center"
    >
      <MiloStage pose="loading" className="w-36 md:w-44" />
      <div className="space-y-space-xs">
        <Text variant="section-heading">{label}</Text>
        {hint && (
          <Text variant="body-secondary" tone="secondary">
            {hint}
          </Text>
        )}
      </div>
      <div
        aria-hidden="true"
        className="h-1 w-40 overflow-hidden rounded-pill bg-surface-muted"
      >
        <div className="milo-progress h-full w-1/3 rounded-pill bg-accent" />
      </div>
    </div>
  );
}

/** A route segment's loading screen, inside the page's own layout. */
export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="grid min-h-[60vh] flex-1 place-items-center px-margin-sm py-space-2xl">
      <MiloLoading {...(label ? { label } : {})} />
    </div>
  );
}

/** A full message with Milo: errors, not found and other dead ends. */
export function MiloMessage({
  pose,
  eyebrow,
  title,
  description,
  children,
  className,
}: {
  pose: MiloPose;
  eyebrow?: ReactNode;
  title: string;
  description: ReactNode;
  /** Actions and details under the message. */
  children?: ReactNode;
  /** Defaults to a full-screen page. */
  className?: string;
}) {
  return (
    <main
      className={cn(
        'grid min-h-screen place-items-center bg-canvas px-margin-sm py-space-2xl',
        className,
      )}
    >
      <div className="milo-enter flex w-full max-w-lg flex-col items-center gap-space-md text-center">
        <MiloStage pose={pose} className="w-40 md:w-48" />
        <div className="space-y-space-xs">
          {eyebrow && (
            <Text
              variant="caption"
              className="font-semibold tracking-wider text-accent uppercase"
            >
              {eyebrow}
            </Text>
          )}
          <Text as="h1" variant="page-title">
            {title}
          </Text>
          <Text tone="secondary">{description}</Text>
        </div>
        {children}
      </div>
    </main>
  );
}

/**
 * A small Milo moment inside a page: no search results, waiting and other
 * personality states. Structural empty states (no projects, quizzes,
 * questions or participants) use the product illustrations instead.
 */
export function MiloEmpty({
  pose,
  title,
  description,
  children,
  className,
}: {
  pose: MiloPose;
  title: string;
  description?: ReactNode;
  /** Actions under the message. */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'milo-enter flex flex-col items-center gap-space-sm py-space-lg text-center',
        className,
      )}
    >
      <MiloStage pose={pose} className="w-28 md:w-32" />
      <div className="space-y-space-xs">
        <Text as="h2" variant="section-heading">
          {title}
        </Text>
        {description && <Text tone="secondary">{description}</Text>}
      </div>
      {children}
    </div>
  );
}
