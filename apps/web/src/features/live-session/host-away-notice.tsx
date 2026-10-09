import { DoorClosed, WifiOff } from 'lucide-react';
import { Surface, Text } from '@/components/ui';

/**
 * Calm, non-blocking note while the host is disconnected. The quiz keeps
 * running on the server: an active question can still be answered and its
 * timer still ends on time; only the host can move the quiz on.
 */
export function HostAwayNotice({ questionOpen }: { questionOpen: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-margin-sm z-30 flex justify-center px-margin-sm">
      <Surface
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-md items-start gap-space-sm shadow-floating"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-surface-low text-text-secondary"
        >
          <WifiOff size={18} />
        </span>
        <div className="min-w-0">
          <Text variant="label">The host is reconnecting…</Text>
          <Text variant="caption" tone="secondary">
            {questionOpen
              ? 'You can still answer this question before the timer ends.'
              : 'The quiz continues as soon as the host is back.'}
          </Text>
        </div>
      </Surface>
    </div>
  );
}

/**
 * After the room closed (the host closed it, or the server did after a
 * while): the participant keeps their result or the final leaderboard.
 */
export function SessionClosedNotice({ message }: { message: string }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-margin-sm z-30 flex justify-center px-margin-sm">
      <Surface
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex w-full max-w-md items-start gap-space-sm shadow-floating"
      >
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-pill bg-surface-low text-text-secondary"
        >
          <DoorClosed size={18} />
        </span>
        <div className="min-w-0">
          <Text variant="label">{message}</Text>
          <Text variant="caption" tone="secondary">
            Your result is saved to your history.
          </Text>
        </div>
      </Surface>
    </div>
  );
}
