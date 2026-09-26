import { ClipboardList, Plus } from 'lucide-react';
import { Surface, Text } from '@/components/ui';
import { PreviewButton } from '@/components/workspace/preview-actions';

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
      <div className="rounded-card bg-surface-low p-space-md text-accent">
        <ClipboardList size={32} aria-hidden="true" />
      </div>
      <Text as="h3" variant="section-heading">
        {title}
      </Text>
      <Text tone="secondary">{description}</Text>
      {create && (
        <PreviewButton action="Create quiz">
          <Plus size={18} aria-hidden="true" />
          Create your first quiz
        </PreviewButton>
      )}
    </Surface>
  );
}
