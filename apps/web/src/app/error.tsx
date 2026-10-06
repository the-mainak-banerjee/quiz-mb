'use client';
import { RotateCcw } from 'lucide-react';
import { Button, Text } from '@/components/ui';
import { MiloMessage } from '@/components/milo/milo-states';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { APP_LINKS } from '@/config/navigation';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const isDevelopment = process.env.NODE_ENV === 'development';

  return (
    <MiloMessage
      pose="error"
      eyebrow="Something went wrong"
      title="Milo hit a snag"
      description="This page didn’t load properly. Try again, and if it keeps happening, come back in a moment."
    >
      <div className="flex flex-col gap-space-xs sm:flex-row">
        <Button
          icon={<RotateCcw size={18} aria-hidden="true" />}
          onClick={reset}
        >
          Try again
        </Button>
        <NavigationItem
          href={APP_LINKS.HOME}
          className="bg-action-secondary text-accent hover:bg-action-secondary-hover"
        >
          Go home
        </NavigationItem>
      </div>
      {isDevelopment && (
        <pre className="w-full overflow-x-auto rounded-control bg-danger-surface p-space-sm text-left text-caption text-danger-on-surface">
          {error.message}
        </pre>
      )}
      {error.digest && (
        <Text variant="caption" tone="secondary">
          Error ID: {error.digest}
        </Text>
      )}
    </MiloMessage>
  );
}
