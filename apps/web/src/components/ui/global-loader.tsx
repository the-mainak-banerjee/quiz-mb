import { LoaderCircle } from 'lucide-react';
import { Text } from './text';

export function GlobalLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className="fixed inset-0 z-50 flex items-center justify-center bg-canvas/90 p-gutter backdrop-blur-(--overlay-blur)"
    >
      <div className="flex flex-col items-center gap-space-sm rounded-card border border-border-surface bg-surface p-space-lg shadow-floating">
        <LoaderCircle
          size={32}
          aria-hidden="true"
          className="animate-spin text-accent motion-reduce:animate-none"
        />
        <Text variant="label">{label}</Text>
      </div>
    </div>
  );
}
