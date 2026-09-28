import type { ProjectDto } from '@quizmb/contracts';
import { loadApi } from '@/lib/api/server';
import { API_ROUTES } from '@/lib/api/routes';
import { ProjectsView } from '@/features/projects/projects-view';
export default async function ProjectsPage() {
  const projects = await loadApi<ProjectDto[]>(API_ROUTES.PROJECTS.LIST);
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col space-y-space-lg px-margin-sm py-space-lg md:px-margin lg:px-space-xl">
      <ProjectsView initial={projects} />
    </main>
  );
}
