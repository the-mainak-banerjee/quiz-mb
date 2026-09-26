import { FolderPlus, Plus, ShieldCheck, UsersRound } from 'lucide-react';
import { Surface, Text } from '@/components/ui';
import { PreviewButton } from '@/components/workspace/preview-actions';
import { QuizCard } from './quiz-card';
import { QuizList } from './quiz-list';
import { ProjectCard } from './project-card';
import type { Quiz } from './mock-data';
import { DashboardEmptyState } from './dashboard-empty-state';
import { getGreeting } from '@/lib/utils';

export function DashboardView({
  user,
  quizzes = [],
  projects = [],
  upcomingQuiz = null,
}: {
  user: { name: string };
  quizzes?: Quiz[];
  projects?: readonly {
    id: string;
    title: string;
    quizzes: number;
    members: number;
  }[];
  upcomingQuiz?: Quiz | null;
}) {
  const empty = quizzes.length === 0 && !upcomingQuiz && projects.length === 0;
  const greeting = getGreeting();
  const hosting =
    quizzes.filter((quiz) => quiz.role === 'host').length +
    (upcomingQuiz?.role === 'host' ? 1 : 0);
  const participating = quizzes.filter(
    (quiz) => quiz.role === 'participant',
  ).length;
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
          <PreviewButton action="Create quiz">
            <Plus size={18} aria-hidden="true" />
            Create quiz
          </PreviewButton>
        </div>
      </div>
      {empty ? (
        <DashboardEmptyState />
      ) : (
        <>
          <section
            aria-label="Workspace overview"
            className="grid gap-gutter md:grid-cols-2"
          >
            {upcomingQuiz && <QuizCard quiz={upcomingQuiz} featured />}
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
                    breakdown: [
                      { count: 1, label: 'live ready' },
                      { count: 2, label: 'scheduled' },
                      { count: 1, label: 'draft' },
                    ],
                    Icon: ShieldCheck,
                  },
                  {
                    label: 'Participating',
                    count: participating,
                    breakdown: [
                      { count: 1, label: 'live now' },
                      { count: 1, label: 'registered' },
                      { count: 1, label: 'completed' },
                    ],
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
                      {breakdown.map((item, index) => (
                        <span key={item.label}>
                          {index > 0 && ', '}
                          <strong className="font-semibold text-text-primary">
                            {item.count}
                          </strong>{' '}
                          {item.label}
                        </span>
                      ))}
                    </Text>
                  </div>
                ))}
              </div>
            </Surface>
          </section>
          <QuizList quizzes={quizzes} hostCount={hosting} />
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
              <PreviewButton action="New project" variant="secondary">
                <FolderPlus size={18} aria-hidden="true" />
                New project
              </PreviewButton>
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
