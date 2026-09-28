import { notFound } from 'next/navigation';
import { z } from 'zod';
import type { ProjectDto } from '@quizmb/contracts';
import { loadApi } from '@/lib/api/server';
import { ProjectSelection } from '@/features/quiz-builder/project-selection';
import { QuizEditor } from '@/features/quiz-builder/quiz-editor';
export default async function CreateQuizPage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const { projectId } = await searchParams;
  if (!projectId)
    return (
      <ProjectSelection
        initialProjects={await loadApi<ProjectDto[]>('/api/projects')}
      />
    );
  if (!z.uuid().safeParse(projectId).success) notFound();
  return (
    <QuizEditor
      project={await loadApi<ProjectDto>(`/api/projects/${projectId}`)}
    />
  );
}
