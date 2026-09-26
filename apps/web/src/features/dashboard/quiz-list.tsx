'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { Button, Input, Text } from '@/components/ui';
import { VisuallyHidden } from '@/components/visually-hidden';
import { cn } from '@/lib/utils';
import { QuizCard } from './quiz-card';
import { EmptyState } from './empty-state';
import { PreviewButton } from '@/components/workspace/preview-actions';
import type { Quiz } from './mock-data';

export function QuizList({
  quizzes,
  hostCount,
}: {
  quizzes: Quiz[];
  hostCount: number;
}) {
  const [filter, setFilter] = useState<'all' | 'host' | 'participant'>('all');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);
  const filters = [
    {
      value: 'all',
      label: `All (${hostCount + quizzes.filter((q) => q.role === 'participant').length})`,
    },
    { value: 'host', label: `Hosting (${hostCount})` },
    {
      value: 'participant',
      label: `Participating (${quizzes.filter((q) => q.role === 'participant').length})`,
    },
  ] as const;
  const visible = quizzes.filter(
    (quiz) =>
      (filter === 'all' || quiz.role === filter) &&
      `${quiz.title} ${quiz.project}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );
  return (
    <section
      id="recent-quizzes"
      aria-labelledby="quizzes-heading"
      className="scroll-mt-space-2xl space-y-space-md"
    >
      <div className="flex items-start justify-between gap-space-sm">
        <div>
          <Text as="h2" id="quizzes-heading" variant="section-heading">
            Recent quizzes
          </Text>
          <Text variant="caption" tone="secondary">
            Draft, ready, and completed sessions across your teams
          </Text>
        </div>
        <PreviewButton
          action="View all quizzes"
          variant="ghost"
          className="shrink-0"
        >
          View all
          <ArrowRight size={16} aria-hidden="true" />
        </PreviewButton>
      </div>
      <div className="flex flex-col gap-space-sm md:flex-row md:items-center md:justify-between">
        <div className="relative h-control-large w-full min-w-0 md:flex-1">
          <Button
            variant="ghost"
            aria-expanded={searchOpen}
            aria-controls="quiz-search"
            onClick={() => setSearchOpen(true)}
            className={cn(
              'absolute inset-y-0 left-0 transition-[opacity,transform] duration-(--motion-duration) ease-out motion-reduce:transition-none',
              searchOpen
                ? 'pointer-events-none -translate-y-space-xs opacity-0'
                : 'translate-y-0 opacity-100',
            )}
          >
            <Search size={18} aria-hidden="true" />
            Search quizzes
          </Button>
          <div
            id="quiz-search"
            role="search"
            aria-hidden={!searchOpen}
            className={cn(
              'absolute inset-0 flex min-w-0 items-center gap-space-xs transition-[opacity,transform] duration-(--motion-duration) ease-out motion-reduce:transition-none',
              searchOpen
                ? 'translate-y-0 opacity-100'
                : 'pointer-events-none translate-y-space-xs opacity-0',
            )}
          >
            <label htmlFor="dashboard-query">
              <VisuallyHidden>Search by quiz or project name</VisuallyHidden>
            </label>
            <Input
              ref={searchInputRef}
              id="dashboard-query"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Find a quiz…"
              tabIndex={searchOpen ? 0 : -1}
            />
            <Button
              variant="ghost"
              tabIndex={searchOpen ? 0 : -1}
              onClick={() => {
                setQuery('');
                setSearchOpen(false);
              }}
            >
              Cancel
            </Button>
          </div>
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
          {visible.map((quiz) => (
            <QuizCard key={quiz.id} quiz={quiz} />
          ))}
        </div>
      ) : (
        <EmptyState
          title={
            quizzes.length ? 'No matching quizzes' : 'No quizzes hosted yet'
          }
          description={
            quizzes.length
              ? 'Try another search or switch your role filter.'
              : 'Build questions from scratch or start with our thoughtfully crafted templates.'
          }
          create={!quizzes.length}
        />
      )}
    </section>
  );
}
