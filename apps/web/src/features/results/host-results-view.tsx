'use client';

import { useState } from 'react';
import { ArrowLeft, ChevronDown, Info } from 'lucide-react';
import type { HostQuizResultsDto } from '@quizmb/contracts';
import { Avatar, Badge, Button, Surface, Text } from '@/components/ui';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { APP_LINKS } from '@/config/navigation';
import { apiError } from '@/lib/api/client';
import { resultsApi } from '@/lib/api/results';
import { cn } from '@/lib/utils';
import { StatTile } from '@/features/live-session/stat-tile';
import { CompletedDate } from './history-view';

/**
 * Host results for a completed quiz: totals and every participant ranked,
 * one page at a time (ties share a rank).
 */
export function HostResultsView({ initial }: { initial: HostQuizResultsDto }) {
  const [entries, setEntries] = useState(initial.entries);
  const [nextOffset, setNextOffset] = useState(initial.nextOffset);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { quiz, summary } = initial;
  const unused = summary.quizQuestionCount - summary.askedQuestionCount;

  async function loadMore() {
    if (nextOffset === null) return;
    setLoading(true);
    setError('');
    try {
      const page = await resultsApi.hostResults(quiz.id, nextOffset);
      setEntries((current) => [...current, ...page.entries]);
      setNextOffset(page.nextOffset);
    } catch (cause) {
      setError(apiError(cause).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-space-lg">
      <NavigationItem
        href={APP_LINKS.WORKSPACE.MANAGE_QUIZ(quiz.id)}
        icon={<ArrowLeft size={18} aria-hidden="true" />}
        className="self-start px-space-xs"
      >
        Back to quiz
      </NavigationItem>

      <div className="flex flex-col gap-space-xs md:flex-row md:items-end md:justify-between">
        <div className="space-y-space-xs">
          <Text
            variant="caption"
            className="font-semibold tracking-wider text-accent uppercase"
          >
            {quiz.projectName} · <CompletedDate value={summary.completedAt} />
          </Text>
          <Text as="h1" variant="page-title">
            {quiz.title}
          </Text>
        </div>
        <Badge variant="draft" label="Completed" className="self-start" />
      </div>

      <div className="grid grid-cols-1 gap-gutter-sm sm:grid-cols-3">
        <StatTile
          label="Participants"
          value={summary.participantCount.toLocaleString()}
          suffix="took part"
        />
        <StatTile
          label="Questions asked"
          value={summary.askedQuestionCount}
          suffix={`of ${summary.quizQuestionCount}`}
        >
          {unused > 0 && (
            <Text
              variant="caption"
              tone="secondary"
              className="flex items-center gap-1"
            >
              <Info size={14} aria-hidden="true" />
              {unused} unasked {unused === 1 ? 'question is' : 'questions are'}{' '}
              not counted
            </Text>
          )}
        </StatTile>
        <StatTile
          label="Average score"
          value={summary.averageScore.toLocaleString()}
          suffix="pts"
        />
      </div>

      <Surface as="section" aria-labelledby="ranked-results" className="p-0">
        <div className="space-y-1 p-space-md">
          <Text as="h2" id="ranked-results" variant="section-heading">
            Ranked participant results
          </Text>
          <Text variant="body-secondary" tone="secondary">
            Counts cover the {summary.scoredQuestionCount} scored{' '}
            {summary.scoredQuestionCount === 1 ? 'question' : 'questions'} you
            asked; descriptive questions are not scored.
          </Text>
        </div>
        {entries.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-xl border-collapse text-left">
              <thead className="border-y border-border-surface bg-surface-low text-caption font-semibold tracking-wider text-text-secondary uppercase">
                <tr>
                  <th scope="col" className="px-space-md py-space-xs">
                    Rank
                  </th>
                  <th scope="col" className="px-space-sm py-space-xs">
                    Participant
                  </th>
                  <th
                    scope="col"
                    className="px-space-sm py-space-xs text-right"
                  >
                    Score
                  </th>
                  <th
                    scope="col"
                    className="px-space-sm py-space-xs text-right"
                  >
                    Correct
                  </th>
                  <th
                    scope="col"
                    className="px-space-sm py-space-xs text-right"
                  >
                    Incorrect
                  </th>
                  <th
                    scope="col"
                    className="px-space-md py-space-xs text-right"
                  >
                    Not attempted
                  </th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr
                    key={entry.userId}
                    className="border-b border-border-surface last:border-b-0"
                  >
                    <td className="px-space-md py-space-sm">
                      <span
                        className={cn(
                          'inline-flex size-8 items-center justify-center rounded-pill text-label font-bold',
                          entry.rank === 1 &&
                            'bg-action-primary text-action-on-primary',
                          (entry.rank === 2 || entry.rank === 3) &&
                            'bg-surface-high',
                        )}
                      >
                        {entry.rank}
                      </span>
                    </td>
                    <td className="px-space-sm py-space-sm">
                      <span className="flex items-center gap-space-xs">
                        <Avatar
                          name={entry.name}
                          size="small"
                          tone="neutral"
                          decorative
                        />
                        <Text as="span" variant="label">
                          {entry.name}
                        </Text>
                      </span>
                    </td>
                    <td className="px-space-sm py-space-sm text-right text-label font-bold text-text-primary">
                      {entry.score.toLocaleString()}{' '}
                      <span className="text-caption font-medium text-text-secondary">
                        pts
                      </span>
                    </td>
                    <td className="px-space-sm py-space-sm text-right text-label text-accent">
                      {entry.correctCount}
                    </td>
                    <td className="px-space-sm py-space-sm text-right text-label text-text-primary">
                      {entry.incorrectCount}
                    </td>
                    <td className="px-space-md py-space-sm text-right text-label text-text-secondary">
                      {entry.notAttemptedCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Text tone="secondary" className="px-space-md pb-space-md">
            Nobody joined the live room, so there are no results.
          </Text>
        )}
        {entries.length > 0 && (
          <div className="flex flex-col gap-space-sm border-t border-border-surface bg-surface-low p-space-md sm:flex-row sm:items-center sm:justify-between">
            <Text variant="caption" tone="secondary">
              Showing {entries.length.toLocaleString()} of{' '}
              {summary.participantCount.toLocaleString()} participants
            </Text>
            {nextOffset !== null && (
              <Button
                variant="outline"
                disabled={loading}
                onClick={() => void loadMore()}
                icon={<ChevronDown size={18} aria-hidden="true" />}
              >
                {loading ? 'Loading…' : 'Load more participants'}
              </Button>
            )}
          </div>
        )}
        {error && (
          <Text
            role="alert"
            variant="caption"
            className="px-space-md pb-space-md text-danger"
          >
            {error}
          </Text>
        )}
      </Surface>
    </div>
  );
}
