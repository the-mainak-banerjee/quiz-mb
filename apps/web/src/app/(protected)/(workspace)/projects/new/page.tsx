import { ProjectEditor } from '@/features/projects/project-editor';
import { requireUser } from '@/lib/auth/session';
export default async function NewProjectPage() {
  await requireUser();
  return <ProjectEditor />;
}
