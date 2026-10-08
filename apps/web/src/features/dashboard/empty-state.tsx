import { ClipboardList, Plus } from 'lucide-react';
import { Surface, Text } from '@/components/ui';
import { EmptyStateIllustration } from '@/components/empty-state-illustration';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { APP_LINKS } from '@/config/navigation';

export function EmptyState({
  title,
  description,
  create = false,
}: {
  title: string;
  description: string;
  create?: boolean;
}) {
  return (
    <Surface className="flex flex-col items-center gap-space-md py-space-xl text-center md:py-space-2xl">
      {create ? (
        <EmptyStateIllustration kind="quiz" />
      ) : (
        <div className="rounded-card bg-surface-low p-space-md text-accent">
          <ClipboardList size={32} aria-hidden="true" />
        </div>
      )}
      <Text as="h3" variant="section-heading">
        {title}
      </Text>
      <Text tone="secondary">{description}</Text>
      {create && (
        <NavigationItem
          href={APP_LINKS.WORKSPACE.NEW_QUIZ}
          icon={<Plus size={18} aria-hidden="true" />}
          className="ds-primary-motion h-control bg-action-primary text-action-on-primary hover:bg-action-primary-hover hover:text-action-on-primary"
        >
          Create your first quiz
        </NavigationItem>
      )}
    </Surface>
  );
}
