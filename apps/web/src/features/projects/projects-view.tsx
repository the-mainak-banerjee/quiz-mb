'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  Clock3,
  FolderOpen,
  FolderPlus,
  History,
  Layers3,
  ListChecks,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';
import {
  ACCOUNT_LIMITS,
  ACTIVE_QUIZ_STATUSES,
  QUIZ_STATUS,
  type ProjectDto,
  type QuizSummaryDto,
} from '@quizmb/contracts';
import { Button, Input, Surface, Text } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { APP_LINKS } from '@/config/navigation';
import { QuizCard } from '@/features/dashboard/quiz-card';
import type { Quiz } from '@/features/dashboard/types';
import { ProjectForm } from '@/features/projects/project-form';
import { DeleteDraftQuizButton } from '@/features/quiz-builder/delete-draft-quiz-button';
import { api } from '@/lib/api/browser';
import { apiError } from '@/lib/api/client';
import { API_ROUTES } from '@/lib/api/routes';

type QuizFilter = 'all' | 'scheduled' | 'draft' | 'completed';

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(value));
}

function EmptyProjects({ onCreate }: { onCreate: () => void }) {
  const benefits = [
    {
      Icon: Layers3,
      title: 'Simple organization',
      description: 'Group quizzes by topic, team sprint, or course.',
    },
    {
      Icon: Sparkles,
      title: 'Shared context',
      description: 'Move easily between quizzes in the same group.',
    },
    {
      Icon: History,
      title: 'Session history',
      description: 'Keep past runs and upcoming drafts organized.',
    },
  ];

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center py-space-xl text-center">
      <div className="flex size-control-large items-center justify-center rounded-card bg-action-secondary text-accent">
        <FolderPlus size={24} aria-hidden="true" />
      </div>
      <Text as="h1" variant="page-title" className="mt-space-md">
        Create your first project
      </Text>
      <Text tone="secondary" className="mt-space-xs max-w-xl">
        Every quiz in QuizMB belongs to a project. Projects simply help you
        organize and group related quizzes.
      </Text>
      <Button
        className="mt-space-md"
        icon={<Plus size={18} aria-hidden="true" />}
        onClick={onCreate}
      >
        Create project
      </Button>
      <div className="mt-space-xl grid w-full gap-space-sm text-left md:grid-cols-3">
        {benefits.map(({ Icon, title, description }) => (
          <div
            key={title}
            className="flex gap-space-sm rounded-card bg-surface-low p-space-sm"
          >
            <Icon
              className="shrink-0 text-accent"
              size={20}
              aria-hidden="true"
            />
            <div className="space-y-space-xs">
              <Text variant="label">{title}</Text>
              <Text variant="caption" tone="secondary">
                {description}
              </Text>
            </div>
          </div>
        ))}
      </div>
      <Text
        variant="caption"
        tone="secondary"
        className="mt-space-md rounded-control bg-surface-muted px-control-x py-badge-y"
      >
        Projects are lightweight folders that keep your quizzes neatly grouped.
      </Text>
    </section>
  );
}

export function ProjectsView({ initial }: { initial: ProjectDto[] }) {
  const router = useRouter();
  const form = useRef<{ close: () => void }>(null);
  const [items, setItems] = useState(initial);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [more, setMore] = useState(initial.length === 25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const createModal = (
    <Modal
      open={createOpen}
      onOpenChange={(open) => {
        if (open) setCreateOpen(true);
        else form.current?.close();
      }}
      title="New project"
      description="Create a simple group for related quizzes."
    >
      <ProjectForm
        ref={form}
        onCancel={() => setCreateOpen(false)}
        onSaved={(project) => {
          setItems((current) => [project, ...current]);
          setCreateOpen(false);
          router.push(APP_LINKS.WORKSPACE.PROJECT(project.id));
        }}
      />
    </Modal>
  );

  if (!items.length) {
    return (
      <>
        <EmptyProjects onCreate={() => setCreateOpen(true)} />
        {createModal}
      </>
    );
  }

  // The API enforces the limit; this explains it before anyone tries.
  const atLimit = items.length >= ACCOUNT_LIMITS.projects;
  const totalQuizzes = items.reduce(
    (total, project) => total + project.quizCount,
    0,
  );

  return (
    <>
      <div className="flex flex-col gap-space-md lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-space-xs">
          <Text
            variant="label"
            className="inline-flex items-center gap-space-xs uppercase text-accent"
          >
            <FolderOpen size={16} aria-hidden="true" />
            Organize &amp; categorize
          </Text>
          <Text as="h1" variant="page-title">
            Projects
          </Text>
          <Text tone="secondary" className="max-w-2xl">
            Lightweight containers for your knowledge checks, cohorts, and
            recurring live sessions.
          </Text>
        </div>
        <div className="flex flex-col items-start gap-space-xs lg:items-end">
          <Button
            icon={<Plus size={18} aria-hidden="true" />}
            disabled={atLimit}
            onClick={() => setCreateOpen(true)}
          >
            Create project
          </Button>
          {atLimit && (
            <Text variant="caption" tone="secondary">
              You can have up to {ACCOUNT_LIMITS.projects} projects. Delete one
              to create a new project.
            </Text>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-space-sm lg:flex-row lg:items-center lg:justify-between">
        <label className="relative block w-full lg:max-w-xl">
          <Search
            className="pointer-events-none absolute left-control-x top-1/2 -translate-y-1/2 text-text-secondary"
            size={18}
            aria-hidden="true"
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search projects by title or description…"
            aria-label="Search projects"
            className="pl-space-xl"
          />
        </label>
      </div>

      {initial.length ? (
        <div className="grid gap-gutter md:grid-cols-2">
          {initial.map((project) => (
            <Surface
              key={project.id}
              as="article"
              className="flex min-w-0 flex-col gap-space-md"
            >
              <div className="flex items-start justify-between gap-space-sm">
                <div className="flex size-control shrink-0 items-center justify-center rounded-control bg-action-secondary text-accent">
                  <FolderOpen size={20} aria-hidden="true" />
                </div>
                <Text
                  as="span"
                  variant="caption"
                  tone="secondary"
                  className="rounded-pill bg-surface-muted px-badge-x py-badge-y"
                >
                  {project.quizCount}{' '}
                  {project.quizCount === 1 ? 'quiz' : 'quizzes'}
                </Text>
              </div>
              <div className="flex-1 space-y-space-xs">
                <Text as="h2" variant="section-heading">
                  {project.name}
                </Text>
                {project.description && (
                  <Text variant="body-secondary" tone="secondary">
                    {project.description}
                  </Text>
                )}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-space-sm border-t border-border-surface pt-space-sm">
                <Text
                  as="span"
                  variant="caption"
                  tone="secondary"
                  className="inline-flex items-center gap-space-xs"
                >
                  <Clock3 size={15} aria-hidden="true" />
                  Updated {formatDate(project.updatedAt)}
                </Text>
                <NavigationItem
                  href={APP_LINKS.WORKSPACE.PROJECT(project.id)}
                  icon={<ArrowRight size={16} aria-hidden="true" />}
                  iconPosition="right"
                  className="px-space-xs text-accent"
                >
                  Open project
                </NavigationItem>
              </div>
            </Surface>
          ))}
          <Button
            variant="outline"
            disabled={atLimit}
            icon={
              <FolderPlus
                className="text-accent"
                size={28}
                aria-hidden="true"
              />
            }
            onClick={() => setCreateOpen(true)}
            className="h-auto min-h-56 flex-col border-dashed bg-surface-low p-space-md"
          >
            <Text as="span" variant="card-title">
              New project container
            </Text>
            <Text as="span" variant="caption" tone="secondary">
              Organize another topic, course module, or assessment.
            </Text>
          </Button>
        </div>
      ) : (
        <Surface className="text-center">
          <Text as="h2" variant="section-heading">
            No matching projects
          </Text>
          <Text tone="secondary" className="mt-space-xs">
            Try a different project name or description.
          </Text>
        </Surface>
      )}

      <div className="flex flex-wrap items-center justify-between gap-space-sm rounded-card bg-surface-muted p-space-sm">
        <Text variant="caption" tone="secondary">
          Projects are lightweight folders designed to keep your quizzes cleanly
          categorized.
        </Text>
        <div className="flex gap-space-md">
          <Text variant="label">
            {items.length} of {ACCOUNT_LIMITS.projects} projects
          </Text>
          <Text variant="label">{totalQuizzes} enclosed quizzes</Text>
        </div>
      </div>

      {error && (
        <Text role="alert" className="text-danger">
          {error}
        </Text>
      )}
      {more && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const rows = await api.get<ProjectDto[]>(
                `${API_ROUTES.PROJECTS.LIST}?cursor=${items.at(-1)!.id}`,
                { authenticated: true },
              );
              setItems((current) => [...current, ...rows]);
              setMore(rows.length === 25);
            } catch (caught) {
              setError(apiError(caught).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Load more projects
        </Button>
      )}
      {createModal}
    </>
  );
}

function quizStatus(status: string): Quiz['status'] {
  if (status === QUIZ_STATUS.DRAFT) return 'draft';
  if (status === QUIZ_STATUS.COMPLETED) return 'completed';
  if (status === QUIZ_STATUS.LIVE || status === QUIZ_STATUS.LOBBY)
    return 'live';
  return 'scheduled';
}

function quizAction(status: string) {
  if (status === QUIZ_STATUS.DRAFT) return 'Edit Draft';
  if (status === QUIZ_STATUS.COMPLETED) return 'View Results';
  if (status === QUIZ_STATUS.LIVE || status === QUIZ_STATUS.LOBBY)
    return 'Launch Room';
  return 'Manage';
}

function quizDescription(status: string) {
  if (status === QUIZ_STATUS.DRAFT) {
    return 'Continue shaping this quiz before it is published.';
  }
  if (status === QUIZ_STATUS.COMPLETED) {
    return 'Review this completed quiz and its results.';
  }
  if (status === QUIZ_STATUS.LIVE || status === QUIZ_STATUS.LOBBY) {
    return 'This quiz is ready for its live session.';
  }
  return 'Manage this quiz before its scheduled session.';
}

export function ProjectQuizzes({
  project,
  initial,
}: {
  project: ProjectDto;
  initial: QuizSummaryDto[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [filter, setFilter] = useState<QuizFilter>('all');
  const [more, setMore] = useState(initial.length === 25);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const counts = {
    scheduled: items.filter((quiz) =>
      ACTIVE_QUIZ_STATUSES.includes(quiz.status),
    ).length,
    draft: items.filter((quiz) => quiz.status === QUIZ_STATUS.DRAFT).length,
    completed: items.filter((quiz) => quiz.status === QUIZ_STATUS.COMPLETED)
      .length,
  };
  const filters: { value: QuizFilter; label: string }[] = [
    { value: 'all', label: `All (${items.length})` },
    { value: 'scheduled', label: `Scheduled (${counts.scheduled})` },
    { value: 'draft', label: `Draft (${counts.draft})` },
    { value: 'completed', label: `Completed (${counts.completed})` },
  ];
  const visible = items.filter((quiz) => {
    if (filter === 'all') return true;
    if (filter === 'scheduled') {
      return ACTIVE_QUIZ_STATUSES.includes(quiz.status);
    }
    return quiz.status === filter.toUpperCase();
  });

  return (
    <section
      aria-labelledby="project-quizzes-heading"
      className="min-w-0 space-y-space-md"
    >
      <div className="flex min-w-0 flex-col gap-space-sm md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-space-xs">
          <Text as="h2" id="project-quizzes-heading" variant="section-heading">
            Quizzes
          </Text>
          <Text
            as="span"
            variant="caption"
            tone="secondary"
            className="rounded-pill bg-surface-muted px-badge-x py-badge-y"
          >
            {items.length}
          </Text>
        </div>
        {items.length > 0 && (
          <div className="flex max-w-full gap-badge-y overflow-x-auto rounded-card bg-surface-muted p-badge-y">
            {filters.map((item) => (
              <Button
                key={item.value}
                variant={filter === item.value ? 'primary' : 'ghost'}
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
                className="whitespace-nowrap rounded-[calc(var(--radius-card)-var(--spacing-badge-y))] px-badge-x"
              >
                {item.label}
              </Button>
            ))}
          </div>
        )}
      </div>

      {visible.length ? (
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3">
          {visible.map((quiz) => {
            const card: Quiz = {
              id: quiz.id,
              project: project.name,
              role: 'host',
              status: quizStatus(quiz.status),
              ...(quiz.status === QUIZ_STATUS.PUBLISHED ||
              quiz.status === QUIZ_STATUS.LOBBY
                ? { statusLabel: 'Live Ready' }
                : {}),
              title: quiz.title,
              description: quizDescription(quiz.status),
              timing: `Updated ${formatDate(quiz.updatedAt)}`,
              detail: `${quiz.questionCount} ${quiz.questionCount === 1 ? 'question' : 'questions'}`,
              action: quizAction(quiz.status),
            };
            return (
              <QuizCard
                key={quiz.id}
                quiz={card}
                actionHref={
                  quiz.status === QUIZ_STATUS.LOBBY ||
                  quiz.status === QUIZ_STATUS.LIVE
                    ? APP_LINKS.WORKSPACE.LIVE_QUIZ(quiz.id)
                    : quiz.status === QUIZ_STATUS.DRAFT
                      ? APP_LINKS.WORKSPACE.EDIT_QUIZ(quiz.id)
                      : quiz.status === QUIZ_STATUS.COMPLETED
                        ? APP_LINKS.WORKSPACE.QUIZ_RESULTS(quiz.id)
                        : APP_LINKS.WORKSPACE.MANAGE_QUIZ(quiz.id)
                }
                {...(quiz.status === QUIZ_STATUS.DRAFT
                  ? {
                      secondaryAction: (
                        <DeleteDraftQuizButton
                          quiz={quiz}
                          onDeleted={() => {
                            setItems((current) =>
                              current.filter((q) => q.id !== quiz.id),
                            );
                            // The page header counts the project's quizzes.
                            router.refresh();
                          }}
                        />
                      ),
                    }
                  : {})}
              />
            );
          })}
        </div>
      ) : (
        <Surface className="flex flex-col items-center py-space-2xl text-center">
          {!items.length && (
            <div className="mb-space-sm flex size-space-2xl items-center justify-center rounded-pill bg-action-secondary text-accent">
              <ListChecks size={28} aria-hidden="true" />
            </div>
          )}
          <Text
            as="h3"
            variant={items.length ? 'card-title' : 'section-heading'}
          >
            {items.length ? 'No quizzes with this status' : 'No quizzes yet'}
          </Text>
          <Text tone="secondary" className="mt-space-xs max-w-sm">
            {items.length
              ? 'Choose another filter to see this project’s quizzes.'
              : 'Create your first quiz for this project.'}
          </Text>
          {!items.length && (
            <NavigationItem
              href={APP_LINKS.WORKSPACE.NEW_PROJECT_QUIZ(project.id)}
              icon={<Plus size={18} aria-hidden="true" />}
              className="ds-primary-motion mt-space-md bg-action-primary text-action-on-primary hover:bg-action-primary-hover hover:text-action-on-primary"
            >
              Create quiz
            </NavigationItem>
          )}
        </Surface>
      )}

      {error && (
        <Text role="alert" className="text-danger">
          {error}
        </Text>
      )}
      {more && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              const rows = await api.get<QuizSummaryDto[]>(
                `${API_ROUTES.PROJECTS.QUIZZES(project.id)}?cursor=${items.at(-1)!.id}`,
                { authenticated: true },
              );
              setItems((current) => [...current, ...rows]);
              setMore(rows.length === 25);
            } catch (caught) {
              setError(apiError(caught).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          Load more quizzes
        </Button>
      )}
    </section>
  );
}
