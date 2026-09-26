import { Building2, GraduationCap, Palette, ChevronRight } from 'lucide-react';
import { Surface, Text } from '@/components/ui';
import { PreviewButton } from '@/components/workspace/preview-actions';
import { cn } from '@/lib/utils';
import { VisuallyHidden } from '@/components/visually-hidden';

export function ProjectCard({
  project,
}: {
  project: { id: string; title: string; quizzes: number; members: number };
}) {
  const Icon =
    project.id === 'design'
      ? Palette
      : project.id === 'company'
        ? Building2
        : GraduationCap;
  return (
    <Surface
      as="article"
      className="flex min-w-0 items-center justify-between gap-space-xs"
    >
      <div className="flex min-w-0 items-center gap-space-sm">
        <div
          className={cn(
            'flex size-control shrink-0 items-center justify-center rounded-control bg-surface-high text-text-secondary',
            project.id === 'design' && 'bg-action-secondary text-accent',
          )}
        >
          <Icon size={20} aria-hidden="true" />
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
      <PreviewButton
        action={`Open ${project.title}`}
        variant="ghost"
        aria-label={`Open ${project.title}`}
        className="px-space-xs"
      >
        <ChevronRight size={18} aria-hidden="true" />
        <VisuallyHidden>Open {project.title}</VisuallyHidden>
      </PreviewButton>
    </Surface>
  );
}
