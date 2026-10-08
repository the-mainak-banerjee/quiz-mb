'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { Button, SearchInput, Surface, Text } from '@/components/ui';
import { MiloEmpty } from '@/components/milo/milo-states';
import { QuizCard } from './quiz-card';
import { EmptyState } from './empty-state';
import { NavigationItem } from '@/components/workspace/navigation-item';
import type { Quiz } from './types';
import { APP_LINKS } from '@/config/navigation';
import { DeleteDraftQuizButton } from '@/features/quiz-builder/delete-draft-quiz-button';

export function QuizList({
  quizzes,
  showViewAll = true,
  displayHeaders = true,
}: {
  quizzes: Quiz[];
  showViewAll?: boolean;
  displayHeaders?: boolean;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'host' | 'participant'>('all');
  /** Deleted here; hidden until the refreshed page data arrives. */
  const [deleted, setDeleted] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const filters = [
    {
      value: 'all',
      label: `All (${quizzes.length})`,
    },
    {
      value: 'host',
      label: `Hosting (${quizzes.filter((quiz) => quiz.role === 'host').length})`,
    },
    {
      value: 'participant',
      label: `Participating (${quizzes.filter((q) => q.role === 'participant').length})`,
    },
  ] as const;
  const visible = quizzes.filter(
    (quiz) =>
      !deleted.includes(quiz.id) &&
      (filter === 'all' || quiz.role === filter) &&
      `${quiz.title} ${quiz.project}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <section
      id="my-quizzes"
      aria-labelledby="quizzes-heading"
      className="scroll-mt-space-2xl space-y-space-md"
    >
      <div className="flex items-start justify-between gap-space-sm">
        {displayHeaders && (
          <div>
            <Text as="h2" id="quizzes-heading" variant="section-heading">
              My quizzes
            </Text>
            <Text variant="caption" tone="secondary">
              Every quiz you host or participate in, across all statuses
            </Text>
          </div>
        )}
        {showViewAll && (
          <NavigationItem
            href={APP_LINKS.WORKSPACE.QUIZZES}
            icon={<ArrowRight size={16} aria-hidden="true" />}
            iconPosition="right"
            className="shrink-0 px-space-xs"
          >
            View all
          </NavigationItem>
        )}
      </div>
      <div className="flex flex-col gap-space-sm md:flex-row md:items-center md:justify-between">
        <div role="search" className="w-full min-w-0 md:max-w-xl md:flex-1">
          <SearchInput
            id="dashboard-query"
            value={query}
            onValueChange={setQuery}
            placeholder="Search quizzes by title or project…"
            aria-label="Search quizzes"
          />
        </div>
        <div
          role="group"
          aria-label="Filter quizzes by role"
          className="grid w-full grid-cols-3 gap-badge-y rounded-card bg-surface-muted p-badge-y md:w-auto"
        >
          {filters.map((item) => (
            <Button
              key={item.value}
              variant={filter === item.value ? 'primary' : 'ghost'}
              aria-pressed={filter === item.value}
              onClick={() => setFilter(item.value)}
              className="min-w-0 whitespace-nowrap rounded-[calc(var(--radius-card)-var(--spacing-badge-y))]! px-badge-y text-caption sm:px-badge-x sm:text-label"
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>
      {visible.length ? (
        <div className="grid grid-cols-1 gap-gutter md:grid-cols-2 lg:grid-cols-3">
          {visible.map((quiz) => {
            const actionHref =
              quiz.role === 'host' && quiz.status === 'completed'
                ? APP_LINKS.WORKSPACE.QUIZ_RESULTS(quiz.id)
                : quiz.role === 'participant' && quiz.liveSessionId
                  ? APP_LINKS.WORKSPACE.HISTORY_RESULT(quiz.liveSessionId)
                  : quiz.role === 'host' && quiz.status === 'live'
                    ? APP_LINKS.WORKSPACE.LIVE_QUIZ(quiz.id)
                    : quiz.role === 'host' && quiz.status === 'scheduled'
                      ? APP_LINKS.WORKSPACE.MANAGE_QUIZ(quiz.id)
                      : quiz.role === 'host' && quiz.status === 'draft'
                        ? APP_LINKS.WORKSPACE.EDIT_QUIZ(quiz.id)
                        : quiz.role === 'participant' && quiz.status === 'live'
                          ? APP_LINKS.PUBLIC_QUIZ_LIVE(quiz.publicId ?? quiz.id)
                          : quiz.role === 'participant'
                            ? APP_LINKS.PUBLIC_QUIZ(quiz.publicId ?? quiz.id)
                            : undefined;

            return (
              <QuizCard
                key={quiz.id}
                quiz={quiz}
                {...(actionHref ? { actionHref } : {})}
                {...(quiz.role === 'host' && quiz.status === 'draft'
                  ? {
                      secondaryAction: (
                        <DeleteDraftQuizButton
                          quiz={quiz}
                          onDeleted={() => {
                            setDeleted((current) => [...current, quiz.id]);
                            // Counts and other sections come from the server.
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
      ) : quizzes.length ? (
        <Surface>
          <MiloEmpty
            pose="search"
            title="No matching quizzes"
            description="Try another search or switch your role filter."
          >
            {query.trim() && (
              <Button variant="secondary" onClick={() => setQuery('')}>
                Clear search
              </Button>
            )}
          </MiloEmpty>
        </Surface>
      ) : (
        <EmptyState
          title="No quizzes yet"
          description="Create a quiz or register for one to see it here."
          create
        />
      )}
    </section>
  );
}
