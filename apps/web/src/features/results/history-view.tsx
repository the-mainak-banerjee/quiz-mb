import { ArrowRight, CalendarDays, LayoutGrid } from 'lucide-react';
import type { ParticipantHistoryDto } from '@quizmb/contracts';
import { Badge, Surface, Text } from '@/components/ui';
import { EmptyStateIllustration } from '@/components/empty-state-illustration';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { LocalDateTime } from '@/components/local-date-time';
import { APP_LINKS } from '@/config/navigation';
import { OutcomeLine } from './result-stats';

/** When a quiz ended, in the viewer's locale (formatted in the browser). */
export function CompletedDate({
  value,
  format = 'date',
}: {
  value: string | null;
  format?: 'date' | 'dateTime';
}) {
  return value ? <LocalDateTime value={value} format={format} /> : 'Completed';
}

function HistoryCard({ item }: { item: ParticipantHistoryDto }) {
  const { quiz, result } = item;
  return (
    <Surface as="article" className="flex h-full flex-col gap-space-sm">
      <div className="flex flex-wrap items-center justify-between gap-space-xs">
        <Badge
          variant="draft"
          label={result ? 'Completed' : 'Did not take part'}
        />
        <Text
          as="span"
          variant="caption"
          tone="secondary"
          className="inline-flex items-center gap-1"
        >
          <CalendarDays size={14} aria-hidden="true" />
          <CompletedDate value={item.completedAt} />
        </Text>
      </div>
      <div className="space-y-1">
        <Text
          variant="caption"
          className="font-semibold tracking-wider text-accent uppercase"
        >
          {quiz.project.name}
        </Text>
        <Text as="h2" variant="card-title">
          {quiz.title}
        </Text>
      </div>
      <div className="flex flex-1 flex-col gap-space-xs rounded-control bg-surface-low p-space-sm">
        {result ? (
          <>
            <div className="flex items-end justify-between gap-space-sm">
              <div>
                <Text variant="caption" tone="secondary">
                  Final score
                </Text>
                <Text as="span" variant="section-heading">
                  {result.totalScore.toLocaleString()}
                  <Text
                    as="span"
                    variant="caption"
                    tone="secondary"
                    className="ml-1"
                  >
                    pts
                  </Text>
                </Text>
              </div>
              <div className="text-right">
                <Text variant="caption" tone="secondary">
                  Final rank
                </Text>
                <Text as="span" variant="section-heading">
                  #{result.rank}
                  <Text
                    as="span"
                    variant="caption"
                    tone="secondary"
                    className="ml-1"
                  >
                    of {result.participantCount.toLocaleString()}
                  </Text>
                </Text>
              </div>
            </div>
            <OutcomeLine result={result} />
          </>
        ) : (
          <Text variant="body-secondary" tone="secondary">
            You registered but did not join the live room, so no score was
            recorded.
          </Text>
        )}
      </div>
      <NavigationItem
        href={APP_LINKS.WORKSPACE.HISTORY_RESULT(item.liveSessionId)}
        icon={<ArrowRight size={18} aria-hidden="true" />}
        iconPosition="right"
        className="self-end bg-action-primary text-action-on-primary hover:bg-action-primary-hover hover:text-action-on-primary"
      >
        View summary
      </NavigationItem>
    </Surface>
  );
}

/** Participant history: completed quizzes with final results. */
export function HistoryView({ items }: { items: ParticipantHistoryDto[] }) {
  return (
    <div className="flex flex-col gap-space-lg">
      <div className="space-y-space-xs">
        <Text as="h1" variant="display">
          History
        </Text>
        <Text tone="secondary">
          Completed quizzes you registered for, with your final score and rank.
        </Text>
      </div>
      {items.length ? (
        <ul className="grid grid-cols-1 gap-gutter md:grid-cols-2">
          {items.map((item) => (
            <li key={item.liveSessionId}>
              <HistoryCard item={item} />
            </li>
          ))}
        </ul>
      ) : (
        <Surface className="flex flex-col items-center gap-space-sm py-space-2xl text-center">
          <EmptyStateIllustration kind="history" />
          <Text as="h2" variant="section-heading">
            No completed quizzes yet
          </Text>
          <Text tone="secondary" className="max-w-md">
            When a quiz you registered for ends, your final score, rank and
            answer summary appear here.
          </Text>
          <NavigationItem
            href={APP_LINKS.WORKSPACE.DASHBOARD}
            icon={<LayoutGrid size={18} aria-hidden="true" />}
            className="bg-action-primary text-action-on-primary hover:bg-action-primary-hover hover:text-action-on-primary"
          >
            Go to dashboard
          </NavigationItem>
        </Surface>
      )}
    </div>
  );
}
