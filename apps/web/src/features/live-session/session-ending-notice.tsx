'use client';
import { useEffect, useState } from 'react';
import { Hourglass } from 'lucide-react';
import { LIVE_SESSION_LIMITS } from '@quizmb/contracts';
import { Callout, Surface, Text } from '@/components/ui';
import { LocalDateTime } from '@/components/local-date-time';
import { cn } from '@/lib/utils';

const WARNING_MS = LIVE_SESSION_LIMITS.warningMinutes * 60_000;
const HOURS = LIVE_SESSION_LIMITS.maxMinutes / 60;

/**
 * True during the final warning before the server ends the quiz at its
 * maximum length (`sessionEndsAt`, server time). Re-checked every 15 s on
 * the server clock, so it appears on time without a page event.
 */
export function useEndingSoon(
  sessionEndsAt: string | null,
  clockOffsetMs: number,
) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!sessionEndsAt) return;
    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [sessionEndsAt]);
  if (!sessionEndsAt) return false;
  return now + clockOffsetMs >= Date.parse(sessionEndsAt) - WARNING_MS;
}

const message = (endsAt: string) => (
  <>
    This quiz ends automatically at{' '}
    <LocalDateTime value={endsAt} format="time" />, the {HOURS}-hour limit for a
    live quiz.
  </>
);

/** The host console's inline warning. */
export function SessionEndingCallout({ endsAt }: { endsAt: string }) {
  return (
    <Callout
      role="status"
      icon={<Hourglass size={16} aria-hidden="true" />}
      className="bg-status-scheduled-surface text-status-scheduled-text"
    >
      {message(endsAt)} Results so far are kept.
    </Callout>
  );
}

/** The participant's floating warning (raised above the host-away note). */
export function SessionEndingNotice({
  endsAt,
  raised = false,
}: {
  endsAt: string;
  raised?: boolean;
}) {
  return (
    <div
      className={cn(
        'pointer-events-none fixed inset-x-0 z-30 flex justify-center px-margin-sm',
        raised ? 'bottom-space-2xl' : 'bottom-margin-sm',
      )}
    >
      <Surface
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-md items-start gap-space-sm shadow-floating"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-status-scheduled-surface text-status-scheduled-text"
        >
          <Hourglass size={18} />
        </span>
        <div className="min-w-0">
          <Text variant="label">Ending soon</Text>
          <Text variant="caption" tone="secondary">
            {message(endsAt)}
          </Text>
        </div>
      </Surface>
    </div>
  );
}
