import {
  ArrowLeft,
  CalendarCheck2,
  CalendarDays,
  CalendarX2,
  Info,
  UserRound,
} from 'lucide-react';
import type { ParticipantQuizResultDto } from '@quizmb/contracts';
import { LocalDateTime } from '@/components/local-date-time';
import { Badge, Callout, Surface, Text } from '@/components/ui';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { APP_LINKS } from '@/config/navigation';
import { AnswerOutcomes, FinalScoreTiles } from './result-stats';

/**
 * A participant's completed quiz: their final score, rank and answer
 * outcomes, or a note that they did not take part. Nothing else (no
 * question-by-question review in the MVP).
 */
export function ParticipantSummary({
  data,
}: {
  data: ParticipantQuizResultDto;
}) {
  const { quiz, result } = data;
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-space-lg">
      <NavigationItem
        href={APP_LINKS.WORKSPACE.HISTORY}
        icon={<ArrowLeft size={18} aria-hidden="true" />}
        className="self-start px-space-xs"
      >
        Back to history
      </NavigationItem>

      <div className="space-y-space-xs">
        <div className="flex flex-wrap items-center gap-space-xs">
          <Badge
            variant="draft"
            label={result ? 'Completed' : 'Did not take part'}
          />
          <Text as="span" variant="caption" tone="secondary">
            {quiz.projectName}
          </Text>
        </div>
        <Text as="h1" variant="page-title">
          {quiz.title}
        </Text>
        <Text
          variant="body-secondary"
          tone="secondary"
          className="flex flex-wrap items-center gap-x-space-sm gap-y-1"
        >
          <span className="inline-flex items-center gap-1">
            <UserRound size={14} aria-hidden="true" />
            Host: {quiz.hostName}
          </span>
          {data.startedAt && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays size={14} aria-hidden="true" />
              Started <LocalDateTime value={data.startedAt} format="dateTime" />
            </span>
          )}
          <span className="inline-flex items-center gap-1">
            <CalendarCheck2 size={14} aria-hidden="true" />
            {data.completedAt ? (
              <>
                Ended{' '}
                <LocalDateTime value={data.completedAt} format="dateTime" />
              </>
            ) : (
              'Completed'
            )}
          </span>
        </Text>
      </div>

      {result ? (
        <Surface
          as="section"
          aria-labelledby="final-performance"
          className="flex flex-col gap-space-md sm:p-space-lg"
        >
          <Text as="h2" id="final-performance" variant="section-heading">
            Final performance
          </Text>
          <FinalScoreTiles result={result} />
          <AnswerOutcomes result={result} />
          <Callout icon={<Info size={16} aria-hidden="true" />}>
            Only questions the host asked are counted, and descriptive questions
            are not scored. This result was saved when the quiz ended.
          </Callout>
        </Surface>
      ) : (
        <Surface className="flex flex-col gap-space-md sm:flex-row sm:p-space-lg">
          <span
            aria-hidden="true"
            className="flex size-12 shrink-0 items-center justify-center rounded-control bg-surface-low text-text-secondary"
          >
            <CalendarX2 size={22} />
          </span>
          <div className="flex flex-col gap-space-sm">
            <Text as="h2" variant="section-heading">
              You didn&apos;t take part in this quiz
            </Text>
            <Text tone="secondary">
              You were registered, but did not join the live room while it was
              running, so no score or rank was recorded.
            </Text>
            <div className="flex flex-col gap-space-xs pt-space-xs sm:flex-row">
              <NavigationItem
                href={APP_LINKS.WORKSPACE.HISTORY}
                className="bg-action-primary text-action-on-primary hover:bg-action-primary-hover hover:text-action-on-primary"
              >
                Back to history
              </NavigationItem>
              <NavigationItem
                href={APP_LINKS.WORKSPACE.DASHBOARD}
                className="bg-surface-low"
              >
                View upcoming quizzes
              </NavigationItem>
            </div>
          </div>
        </Surface>
      )}
    </div>
  );
}
