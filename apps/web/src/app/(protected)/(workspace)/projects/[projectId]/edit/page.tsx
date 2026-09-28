import { notFound } from 'next/navigation';
import { z } from 'zod';
import type { ProjectDto } from '@quizmb/contracts';
import { loadApi } from '@/lib/api/server';
import { ProjectEditor } from '@/features/projects/project-editor';
export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!z.uuid().safeParse(projectId).success) notFound();
  return (
    <ProjectEditor
      initial={await loadApi<ProjectDto>(`/api/projects/${projectId}`)}
    />
  );
}
