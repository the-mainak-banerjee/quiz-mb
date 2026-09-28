import { ChevronRight, FolderOpen } from 'lucide-react';
import { Surface, Text } from '@/components/ui';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { VisuallyHidden } from '@/components/visually-hidden';
import { APP_LINKS } from '@/config/navigation';

export function ProjectCard({
  project,
}: {
  project: { id: string; title: string; quizzes: number; members: number };
}) {
  return (
    <Surface
      as="article"
      className="flex min-w-0 items-center justify-between gap-space-xs"
    >
      <div className="flex min-w-0 items-center gap-space-sm">
        <div className="flex size-control shrink-0 items-center justify-center rounded-control bg-action-secondary text-accent">
          <FolderOpen size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <Text as="h3" variant="card-title">
            {project.title}
          </Text>
          <Text variant="caption" tone="secondary">
            {project.quizzes} quizzes · {project.members} members
          </Text>
        </div>
      </div>
      <NavigationItem
        href={APP_LINKS.WORKSPACE.PROJECT(project.id)}
        aria-label={`Open ${project.title}`}
        icon={<ChevronRight size={18} aria-hidden="true" />}
        className="px-space-xs"
      >
        <VisuallyHidden>Open {project.title}</VisuallyHidden>
      </NavigationItem>
    </Surface>
  );
}
