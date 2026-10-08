import type { ReactNode } from 'react';
import { Surface, Text } from '@/components/ui';
import { cn } from '@/lib/utils';

/** One settings section: a card with a title, a description and content. */
export function SettingsCard({
  title,
  description,
  eyebrow,
  className,
  children,
}: {
  title: string;
  description: string;
  /** Shown above the title, e.g. the danger-zone badge. */
  eyebrow?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Surface
      as="section"
      aria-label={title}
      className={cn('space-y-space-md p-space-lg', className)}
    >
      <div className="space-y-space-xs">
        {eyebrow}
        <Text as="h2" variant="section-heading">
          {title}
        </Text>
        <Text tone="secondary">{description}</Text>
      </div>
      {children}
    </Surface>
  );
}
