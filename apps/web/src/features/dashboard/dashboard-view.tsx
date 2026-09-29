import { FolderPlus, Plus, ShieldCheck, UsersRound } from 'lucide-react';
import { Surface, Text } from '@/components/ui';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { QuizList } from './quiz-list';
import { ProjectCard } from './project-card';
import type { Quiz } from './types';
import { DashboardEmptyState } from './dashboard-empty-state';
import { getGreeting } from '@/lib/utils';
import { APP_LINKS } from '@/config/navigation';

function deduplicateQuizzes(quizzes: Quiz[]) {
  const byId = new Map<string, Quiz>();
  for (const quiz of quizzes) {
    const current = byId.get(quiz.id);
    if (!current || quiz.role === 'host') byId.set(quiz.id, quiz);
  }
  return [...byId.values()];
}

export function DashboardView({
  user,
  quizzes = [],
  projects = [],
}: {
  user: { name: string };
  quizzes?: Quiz[];
  projects?: readonly {
    id: string;
    title: string;
    quizzes: number;
    members: number;
  }[];
}) {
  const uniqueQuizzes = deduplicateQuizzes(quizzes);
  const empty = uniqueQuizzes.length === 0 && projects.length === 0;
  const greeting = getGreeting();
  const hostedQuizzes = uniqueQuizzes.filter((quiz) => quiz.role === 'host');
  const participantQuizzes = uniqueQuizzes.filter(
    (quiz) => quiz.role === 'participant',
  );
  const hosting = hostedQuizzes.length;
  const participating = participantQuizzes.length;
  const breakdown = (
    items: Quiz[],
    labels: Partial<Record<Quiz['status'], string>>,
  ) =>
    (Object.keys(labels) as Quiz['status'][])
      .map((status) => ({
        count: items.filter((quiz) => quiz.status === status).length,
        label: labels[status]!,
      }))
      .filter((item) => item.count > 0);
  return (
    <main
      id="dashboard-content"
      className="mx-auto w-full max-w-content flex-1 space-y-space-xl px-margin-sm py-space-lg md:px-margin lg:px-space-xl"
    >
      <div className="flex flex-wrap items-start justify-between gap-space-md">
        <div className="min-w-0 space-y-space-xs">
          <Text as="h1" variant="page-title" className="wrap-break-word">
            {empty ? 'Welcome to QuizMB,' : greeting} {user.name.split(' ')[0]}
          </Text>
          <Text variant="body-secondary" tone="secondary">
            {empty
              ? 'Create your first live quiz to spark team curiosity.'
              : 'Manage your upcoming live sessions and workspaces.'}
          </Text>
        </div>
        <div className="flex flex-wrap gap-space-xs">
          <NavigationItem
            href={APP_LINKS.WORKSPACE.NEW_QUIZ}
            icon={<Plus size={18} aria-hidden="true" />}
            className="ds-primary-motion h-control bg-action-primary text-action-on-primary hover:bg-action-primary-hover hover:text-action-on-primary"
          >
            Create quiz
          </NavigationItem>
        </div>
      </div>
      {empty ? (
        <DashboardEmptyState />
      ) : (
        <>
          <section aria-label="Workspace overview" className="grid gap-gutter">
            <Surface className="flex min-w-0 flex-col justify-between gap-space-md">
              <div className="flex flex-wrap items-start justify-between gap-space-xs">
                <div className="space-y-space-xs">
                  <Text
                    variant="caption"
                    tone="secondary"
                    className="uppercase"
                  >
                    Unified Workspace Activity
                  </Text>
                  <Text as="h2" variant="section-heading">
                    Host &amp; Participant Status
                  </Text>
                </div>
                <Text
                  as="span"
                  variant="caption"
                  tone="secondary"
                  className="rounded-sm bg-surface-muted px-badge-x py-badge-y"
                >
                  {hosting + participating} Total active
                </Text>
              </div>
              <div className="grid grid-cols-1 gap-space-sm lg:grid-cols-2">
                {[
                  {
                    label: 'Hosting',
                    count: hosting,
                    breakdown: breakdown(hostedQuizzes, {
                      live: 'live now',
                      scheduled: 'scheduled',
                      draft: 'draft',
                      completed: 'completed',
                    }),
                    Icon: ShieldCheck,
                  },
                  {
                    label: 'Participating',
                    count: participating,
                    breakdown: breakdown(participantQuizzes, {
                      live: 'live now',
                      scheduled: 'registered',
                      completed: 'completed',
                    }),
                    Icon: UsersRound,
                  },
                ].map(({ label, count, breakdown, Icon }) => (
                  <div
                    key={label}
                    className="space-y-space-xs rounded-control border border-border-surface bg-surface-low p-space-sm"
                  >
                    <Text
                      variant="label"
                      className="flex items-center gap-space-xs text-accent"
                    >
                      <Icon size={18} aria-hidden="true" />
                      {label}
                    </Text>
                    <Text variant="card-title">
                      {count} {label}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {breakdown.length
                        ? breakdown.map((item, index) => (
                            <span key={item.label}>
                              {index > 0 && ', '}
                              <strong className="font-semibold text-text-primary">
                                {item.count}
                              </strong>{' '}
                              {item.label}
                            </span>
                          ))
                        : 'No quiz activity'}
                    </Text>
                  </div>
                ))}
              </div>
            </Surface>
          </section>
          <QuizList quizzes={uniqueQuizzes} />
          <section
            id="projects"
            aria-labelledby="projects-heading"
            className="scroll-mt-space-2xl space-y-space-md"
          >
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <div>
                <Text as="h2" id="projects-heading" variant="section-heading">
                  Projects
                </Text>
                <Text variant="caption" tone="secondary">
                  Team spaces and question banks
                </Text>
              </div>
              <NavigationItem
                href={APP_LINKS.WORKSPACE.NEW_PROJECT}
                icon={<FolderPlus size={18} aria-hidden="true" />}
                className="h-control bg-action-secondary text-accent hover:bg-action-secondary-hover hover:text-accent"
              >
                New project
              </NavigationItem>
            </div>
            <div className="grid gap-gutter md:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
