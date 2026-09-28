'use client';
import { useRouter } from 'next/navigation';
import type { ProjectDto } from '@quizmb/contracts';
import { Surface, Text } from '@/components/ui';
import { ProjectForm } from './project-form';
export function ProjectEditor({ initial }: { initial?: ProjectDto }) {
  const router = useRouter();
  return (
    <main className="mx-auto w-full max-w-content flex-1 px-margin-sm py-space-xl md:px-margin">
      <Surface className="mx-auto max-w-xl space-y-space-lg">
        <div className="space-y-space-xs">
          <Text as="h1" variant="page-title">
            {initial ? 'Edit project' : 'Create project'}
          </Text>
          <Text tone="secondary">
            A simple group to organize your related quizzes.
          </Text>
        </div>
        <ProjectForm
          {...(initial ? { initial } : {})}
          onCancel={() => router.push('/projects')}
          onSaved={(project) => router.push(`/projects/${project.id}`)}
        />
      </Surface>
    </main>
  );
}
