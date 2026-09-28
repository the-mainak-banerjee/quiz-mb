import Link from 'next/link';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import {
  Archive,
  ArrowLeft,
  Clock3,
  FolderOpen,
  Pencil,
  Plus,
} from 'lucide-react';
import type { ProjectDto, QuizSummaryDto } from '@quizmb/contracts';
import { loadApi } from '@/lib/api/server';
import { API_ROUTES } from '@/lib/api/routes';
import { Text } from '@/components/ui';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { APP_LINKS } from '@/config/navigation';
import { ProjectQuizzes } from '@/features/projects/projects-view';
export default async function ProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  if (!z.uuid().safeParse(projectId).success) notFound();
  const [project, quizzes] = await Promise.all([
    loadApi<ProjectDto>(API_ROUTES.PROJECTS.DETAIL(projectId)),
    loadApi<QuizSummaryDto[]>(API_ROUTES.PROJECTS.QUIZZES(projectId)),
  ]);
  const statusCounts = {
    draft: quizzes.filter((quiz) => quiz.status === 'DRAFT').length,
    scheduled: quizzes.filter((quiz) =>
      ['PUBLISHED', 'SCHEDULED', 'LOBBY', 'LIVE'].includes(quiz.status),
    ).length,
    completed: quizzes.filter((quiz) => quiz.status === 'COMPLETED').length,
  };
  return (
    <main className="mx-auto w-full max-w-content flex-1 space-y-space-xl px-margin-sm py-space-lg md:px-margin lg:px-space-xl">
      <nav
        aria-label="Breadcrumb"
        className="flex min-w-0 flex-wrap items-center gap-space-xs"
      >
        <Link
          className="ds-focus inline-flex min-h-control items-center gap-space-xs rounded-control text-label text-accent hover:underline"
          href={APP_LINKS.WORKSPACE.PROJECTS}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Projects
        </Link>
        <Text as="span" variant="caption" tone="secondary">
          /
        </Text>
        <Text
          as="span"
          variant="caption"
          tone="secondary"
          className="min-w-0 wrap-break-word"
        >
          {project.name}
        </Text>
      </nav>

      <section aria-labelledby="project-heading">
        <div className="flex flex-col gap-space-md lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 items-start gap-space-sm lg:flex-1">
            <div className="flex size-control-large shrink-0 items-center justify-center rounded-card bg-action-secondary text-accent">
              <FolderOpen size={24} aria-hidden="true" />
            </div>
            <div className="min-w-0 space-y-space-xs">
              <Text as="h1" id="project-heading" variant="page-title">
                {project.name}
              </Text>
              {project.description && (
                <Text tone="secondary" className="max-w-3xl">
                  {project.description}
                </Text>
              )}
              <div className="flex flex-wrap items-center gap-x-space-sm gap-y-space-xs pt-space-xs text-text-secondary">
                <Text
                  as="span"
                  variant="caption"
                  className="inline-flex items-center gap-space-xs font-semibold text-text-primary"
                >
                  <Archive
                    size={16}
                    aria-hidden="true"
                    className="text-accent"
                  />
                  {project.quizCount}{' '}
                  {project.quizCount === 1 ? 'quiz' : 'quizzes'}
                </Text>
                <Text as="span" variant="caption" tone="secondary">
                  •
                </Text>
                {quizzes.length > 0 && (
                  <>
                    <Text as="span" variant="caption" tone="secondary">
                      {statusCounts.draft} draft · {statusCounts.scheduled}{' '}
                      scheduled · {statusCounts.completed} completed
                    </Text>
                    <Text as="span" variant="caption" tone="secondary">
                      •
                    </Text>
                  </>
                )}
                <Text
                  as="span"
                  variant="caption"
                  tone="secondary"
                  className="inline-flex items-center gap-space-xs"
                >
                  <Clock3 size={15} aria-hidden="true" />
                  Created{' '}
                  {new Intl.DateTimeFormat('en', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    timeZone: 'UTC',
                  }).format(new Date(project.createdAt))}
                </Text>
              </div>
            </div>
          </div>
          <div className="flex pl-space-2xl lg:pl-0 w-full min-w-0 flex-nowrap gap-space-xs lg:w-auto lg:shrink-0">
            <NavigationItem
              href={APP_LINKS.WORKSPACE.EDIT_PROJECT(projectId)}
              icon={<Pencil size={17} aria-hidden="true" />}
              className="shrink-0 whitespace-nowrap bg-action-secondary text-accent hover:bg-action-secondary-hover"
            >
              Edit project
            </NavigationItem>
            <NavigationItem
              href={APP_LINKS.WORKSPACE.NEW_PROJECT_QUIZ(projectId)}
              icon={<Plus size={18} aria-hidden="true" />}
              className="ds-primary-motion shrink-0 whitespace-nowrap bg-action-primary text-action-on-primary hover:bg-action-primary-hover hover:text-action-on-primary"
            >
              Create quiz
            </NavigationItem>
          </div>
        </div>
      </section>

      <ProjectQuizzes project={project} initial={quizzes} />
    </main>
  );
}
