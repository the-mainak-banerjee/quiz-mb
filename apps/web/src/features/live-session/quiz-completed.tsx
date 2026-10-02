'use client';

import {
  CloudCheck,
  Eye,
  Info,
  LayoutGrid,
  LockKeyhole,
  Radio,
  Table2,
  Trophy,
} from 'lucide-react';
import type {
  FinalSummaryDto,
  LeaderboardDto,
  ParticipantFinalResultDto,
} from '@quizmb/contracts';
import { LocalDateTime } from '@/components/local-date-time';
import { Avatar, Badge, Callout, Surface, Text } from '@/components/ui';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { cn } from '@/lib/utils';
import {
  AnswerOutcomes,
  FinalScoreTiles,
} from '@/features/results/result-stats';
import { ActionButton } from './action-button';
import { LeaderboardTable } from './leaderboard';
import { StatusStrip } from './participant-question';
import { ParticipantStage } from './participant-screens';
import { StatTile } from './stat-tile';
import type { LiveQuizSummary } from './types';

/** Top three as podium cards, the winner in the middle on wider screens. */
function FinalPodium({
  board,
  scoredQuestionCount,
}: {
  board: LeaderboardDto;
  scoredQuestionCount: number;
}) {
  const podium = board.entries.slice(0, 3);
  return (
    <ol
      aria-label="Top three"
      className="grid grid-cols-1 gap-space-sm sm:grid-cols-3 sm:items-end"
    >
      {podium.map((entry, index) => {
        const winner = index === 0;
        return (
          <li
            key={entry.userId}
            className={cn(
              'flex flex-col gap-space-sm rounded-card p-space-md',
              winner
                ? 'bg-action-primary text-action-on-primary shadow-raised sm:order-2 sm:pb-space-lg'
                : 'bg-surface-low',
              index === 1 && 'sm:order-1',
              index === 2 && 'sm:order-3',
            )}
          >
            <div className="flex items-center justify-between gap-space-xs">
              <Text
                as="span"
                variant="page-title"
                tone={winner ? 'inverse' : 'secondary'}
              >
                #{entry.rank}
              </Text>
              {winner && (
                <Badge
                  variant="live"
                  dot={false}
                  label="Winner"
                  className="gap-1"
                />
              )}
            </div>
            <div className="flex min-w-0 items-center gap-space-xs">
              <Avatar
                name={entry.name}
                size="large"
                tone={winner ? 'accent' : 'neutral'}
                decorative
              />
              <div className="min-w-0">
                <Text
                  as="span"
                  variant="card-title"
                  tone={winner ? 'inverse' : 'primary'}
                  className="block truncate"
                >
                  {entry.name}
                </Text>
                {entry.correctCount !== undefined && (
                  <Text
                    as="span"
                    variant="caption"
                    tone={winner ? 'inverse' : 'secondary'}
                  >
                    {entry.correctCount}/{scoredQuestionCount} correct
                  </Text>
                )}
              </div>
            </div>
            <Text
              as="span"
              variant="section-heading"
              tone={winner ? 'inverse' : 'primary'}
              className="text-right"
            >
              {entry.score.toLocaleString()}
              <Text
                as="span"
                variant="caption"
                tone={winner ? 'inverse' : 'secondary'}
                className="ml-1"
              >
                pts
              </Text>
            </Text>
          </li>
        );
      })}
    </ol>
  );
}

/**
 * Host console after End quiz: totals and the final Top 10, privately at
 * first; the host decides when participants see it.
 */
export function HostQuizCompleted({
  quiz,
  summary,
  board,
  shown,
  busy = false,
  onReveal,
  resultsHref,
  dashboardHref,
}: {
  quiz: Pick<LiveQuizSummary, 'title' | 'projectName'>;
  summary: FinalSummaryDto;
  board: LeaderboardDto;
  shown: boolean;
  busy?: boolean;
  onReveal?: (() => void) | undefined;
  resultsHref: string;
  dashboardHref: string;
}) {
  const unused = summary.quizQuestionCount - summary.askedQuestionCount;
  const rest: LeaderboardDto = { ...board, entries: board.entries.slice(3) };
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-space-md px-margin-sm py-space-lg md:px-margin">
      <div className="flex flex-col gap-space-sm md:flex-row md:items-end md:justify-between">
        <div className="space-y-space-xs">
          <Text
            variant="caption"
            tone="secondary"
            className="tracking-wider uppercase"
          >
            {quiz.projectName}
          </Text>
          <Text as="h1" variant="page-title">
            {quiz.title}
          </Text>
        </div>
        <div className="flex flex-wrap gap-space-xs">
          <Badge variant="draft" label="Quiz completed" />
          <Badge
            variant={shown ? 'live' : 'draft'}
            dot={shown}
            label={
              shown ? 'Final leaderboard shown to participants' : 'Private'
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-3">
        <StatTile
          label="Participants"
          value={summary.participantCount.toLocaleString()}
          suffix="took part"
        />
        <StatTile
          label="Questions asked"
          value={summary.askedQuestionCount}
          suffix={`of ${summary.quizQuestionCount}`}
        />
        <StatTile
          label="Ended"
          value={
            <span className="text-section-heading">
              {summary.completedAt ? (
                <LocalDateTime value={summary.completedAt} />
              ) : (
                'Just now'
              )}
            </span>
          }
        />
      </div>

      {unused > 0 && (
        <Callout icon={<Info size={16} aria-hidden="true" />}>
          {unused} unused {unused === 1 ? 'question was' : 'questions were'} not
          counted. Scores use only the questions you asked.
        </Callout>
      )}

      {shown ? (
        <Callout
          role="status"
          icon={<Radio size={16} aria-hidden="true" />}
          className="bg-status-live-surface text-status-live-text"
        >
          <strong className="font-semibold">On participant screens.</strong>{' '}
          Everyone still connected now sees the final Top 10 with their own
          rank.
        </Callout>
      ) : (
        <Surface className="flex flex-col gap-space-sm md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-space-sm">
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-status-live-surface text-accent"
            >
              <LockKeyhole size={18} />
            </span>
            <div>
              <Text variant="card-title">Host private view</Text>
              <Text variant="body-secondary" tone="secondary">
                Participants see their own result. They see this leaderboard
                only when you reveal it.
              </Text>
            </div>
          </div>
          <div className="flex flex-col gap-space-xs sm:flex-row">
            <NavigationItem
              href={resultsHref}
              icon={<Table2 size={18} aria-hidden="true" />}
              className="bg-surface-low"
            >
              View full results
            </NavigationItem>
            <ActionButton
              preview="Revealing the final leaderboard"
              onAction={onReveal}
              disabled={busy}
              icon={<Eye size={18} aria-hidden="true" />}
            >
              Reveal final leaderboard
            </ActionButton>
          </div>
        </Surface>
      )}

      <Surface
        as="section"
        aria-labelledby="final-standings"
        className="flex flex-col gap-space-md sm:p-space-lg"
      >
        <div className="flex items-center gap-space-xs">
          <Trophy size={20} aria-hidden="true" className="text-accent" />
          <Text as="h2" id="final-standings" variant="section-heading">
            Final standings — Top 10
          </Text>
        </div>
        {shown && board.entries.length > 0 ? (
          <>
            <FinalPodium
              board={board}
              scoredQuestionCount={summary.scoredQuestionCount}
            />
            {rest.entries.length > 0 && (
              <LeaderboardTable
                board={rest}
                scoredQuestionCount={summary.scoredQuestionCount}
              />
            )}
          </>
        ) : (
          <LeaderboardTable
            board={board}
            scoredQuestionCount={summary.scoredQuestionCount}
          />
        )}
      </Surface>

      {shown && (
        <div className="flex flex-col-reverse gap-space-xs sm:flex-row sm:justify-end">
          <NavigationItem
            href={dashboardHref}
            icon={<LayoutGrid size={18} aria-hidden="true" />}
            className="bg-surface-low"
          >
            Return to dashboard
          </NavigationItem>
          <NavigationItem
            href={resultsHref}
            icon={<Table2 size={18} aria-hidden="true" />}
            className="bg-action-primary text-action-on-primary hover:bg-action-primary-hover hover:text-action-on-primary"
          >
            View full results
          </NavigationItem>
        </div>
      )}
    </main>
  );
}

/** Participant screen right after End quiz: their own final result. */
export function ParticipantQuizEnded({
  quizTitle,
  result,
  historyHref,
}: {
  quizTitle: string;
  result: ParticipantFinalResultDto | null;
  historyHref: string;
}) {
  return (
    <ParticipantStage className="md:py-space-2xl">
      <div className="flex w-full max-w-2xl flex-col items-center gap-space-md text-center">
        <div className="space-y-space-xs">
          <Badge variant="draft" label="Quiz ended" />
          <Text tone="secondary">{quizTitle}</Text>
        </div>
        <Surface className="flex w-full flex-col gap-space-md text-left shadow-raised sm:p-space-lg">
          <Text as="h1" variant="page-title" className="text-center">
            Your final result
          </Text>
          {result ? (
            <>
              <FinalScoreTiles result={result} />
              <AnswerOutcomes result={result} />
            </>
          ) : (
            <StatusStrip
              icon={
                <span className="ds-live-dot block size-status-dot rounded-pill bg-accent" />
              }
              title="Saving your final result…"
            />
          )}
          <StatusStrip
            icon={
              <span className="ds-live-dot block size-status-dot rounded-pill bg-accent" />
            }
            title="Waiting for the host…"
            detail="The host may reveal the final leaderboard."
          />
        </Surface>
        <Text
          variant="caption"
          tone="secondary"
          className="flex flex-wrap items-center justify-center gap-1"
        >
          <CloudCheck size={14} aria-hidden="true" />
          Your result is saved to your history.
          <NavigationItem
            href={historyHref}
            className="min-h-0 px-1 text-caption text-accent underline"
          >
            Open history
          </NavigationItem>
        </Text>
      </div>
    </ParticipantStage>
  );
}
