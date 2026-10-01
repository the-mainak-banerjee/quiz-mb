'use client';

import { useEffect, useRef } from 'react';
import {
  ArrowLeft,
  EyeOff,
  Medal,
  MonitorUp,
  Radio,
  Star,
  Trophy,
} from 'lucide-react';
import type { LeaderboardDto, ParticipantStandingDto } from '@quizmb/contracts';
import { Avatar, Badge, Callout, Surface, Text } from '@/components/ui';
import { VisuallyHidden } from '@/components/visually-hidden';
import { cn, pluralize } from '@/lib/utils';
import { ActionButton } from './action-button';
import { StatusStrip } from './participant-question';
import { ParticipantStage } from './participant-screens';
import { StatTile } from './stat-tile';

function afterLabel(board: LeaderboardDto) {
  const people = `${board.participantCount.toLocaleString()} ${pluralize(
    board.participantCount,
    'participant',
  )}`;
  return board.afterQuestionNumber
    ? `After question ${board.afterQuestionNumber} · ${people}`
    : people;
}

/** Rank marker: the leaders get a filled badge, everyone else a number. */
function RankMark({ rank }: { rank: number }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-8 shrink-0 items-center justify-center rounded-pill text-label font-bold',
        rank === 1 && 'bg-action-primary text-action-on-primary',
        (rank === 2 || rank === 3) && 'bg-surface-high text-text-primary',
        rank > 3 && 'text-text-secondary',
      )}
    >
      {rank}
    </span>
  );
}

/**
 * Top standings shared by the host and participant views. Ties share a
 * rank and are all listed, so there can be more than ten rows.
 */
export function LeaderboardTable({
  board,
  highlightUserId,
}: {
  board: LeaderboardDto;
  /** The viewer's own row, highlighted as "You". */
  highlightUserId?: string;
}) {
  if (board.entries.length === 0)
    return (
      <Surface className="flex flex-col items-center gap-space-xs py-space-xl text-center">
        <Trophy size={24} aria-hidden="true" className="text-accent" />
        <Text variant="card-title">No standings yet</Text>
        <Text variant="body-secondary" tone="secondary">
          Scores appear here after the first question ends.
        </Text>
      </Surface>
    );
  return (
    <div className="overflow-hidden rounded-card border-(length:--stroke-width) border-border-surface bg-surface">
      <div
        aria-hidden="true"
        className="flex items-center gap-space-sm border-b border-border-surface bg-surface-low px-space-md py-space-xs text-caption font-semibold tracking-wider text-text-secondary uppercase"
      >
        <span className="w-8 text-center">Rank</span>
        <span className="flex-1">Participant</span>
        <span>Score</span>
      </div>
      <ol aria-label="Leaderboard">
        {board.entries.map((entry, index) => {
          const you = entry.userId === highlightUserId;
          return (
            <li
              key={entry.userId}
              className={cn(
                'flex items-center gap-space-sm border-b border-border-surface px-space-md py-space-sm last:border-b-0',
                index === 0 && !you && 'bg-surface-low',
                you && 'bg-status-live-surface',
              )}
            >
              <VisuallyHidden>Rank {entry.rank}: </VisuallyHidden>
              <RankMark rank={entry.rank} />
              <Avatar
                name={entry.name}
                size="small"
                tone={entry.rank === 1 ? 'accent' : 'neutral'}
                decorative
                className="hidden sm:flex"
              />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-space-xs">
                <Text
                  as="span"
                  variant={entry.rank <= 3 ? 'card-title' : 'body'}
                  className="truncate"
                >
                  {entry.name}
                </Text>
                {you && <Badge variant="live" dot={false} label="You" />}
                {entry.rank === 1 && !you && (
                  <Badge variant="live" dot={false} label="Leader" />
                )}
              </div>
              <Text
                as="span"
                variant="label"
                className="shrink-0 text-right font-bold"
              >
                {entry.score.toLocaleString()}
                <Text
                  as="span"
                  variant="caption"
                  tone="secondary"
                  className="ml-1 font-medium"
                >
                  pts
                </Text>
              </Text>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Host leaderboard in the console's main area: a private preview, or what
 * participants currently see once it is shown.
 */
export function HostLeaderboardView({
  board,
  shown,
  busy = false,
  onShow,
  onHide,
  onClose,
  focusKey = 0,
}: {
  board: LeaderboardDto;
  shown: boolean;
  busy?: boolean;
  /** Changes whenever the host asks to see it; it then scrolls into view. */
  focusKey?: number;
  onShow?: (() => void) | undefined;
  onHide?: (() => void) | undefined;
  onClose?: (() => void) | undefined;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // The controls live in the side rail (below the main area on small
  // screens): bring the leaderboard into view unless it is already visible.
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const { top, bottom } = element.getBoundingClientRect();
    const header = parseFloat(getComputedStyle(element).scrollMarginTop) || 0;
    if (top >= header && bottom <= window.innerHeight) return;
    element.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'start',
    });
  }, [focusKey]);
  return (
    <div ref={ref} className="scroll-mt-space-2xl">
      <Surface
        as="section"
        aria-labelledby="host-leaderboard-title"
        className="flex flex-col gap-space-md sm:p-space-lg"
      >
        {shown ? (
          <Callout
            role="status"
            icon={<Radio size={16} aria-hidden="true" />}
            className="bg-status-live-surface text-status-live-text"
          >
            <strong className="font-semibold">On participant screens.</strong>{' '}
            Hide it to return everyone to the question result, or ask the next
            question.
          </Callout>
        ) : (
          <Callout icon={<EyeOff size={16} aria-hidden="true" />}>
            <strong className="font-semibold text-text-primary">
              Host private view.
            </strong>{' '}
            Participants still see the question result until you show this
            leaderboard.
          </Callout>
        )}

        <div className="flex flex-col gap-space-sm">
          <div className="flex flex-wrap items-center gap-space-xs">
            <Badge
              variant={shown ? 'live' : 'draft'}
              label={shown ? 'Showing to participants' : 'Private'}
            />
            <Text
              as="span"
              variant="caption"
              tone="secondary"
              className="tracking-wider uppercase"
            >
              {afterLabel(board)}
            </Text>
          </div>
          <Text as="h2" id="host-leaderboard-title" variant="section-heading">
            Current standing — Top 10
          </Text>
          <div className="flex flex-col flex-wrap gap-space-xs sm:flex-row">
            {shown ? (
              <ActionButton
                variant="outline"
                preview="Hiding the leaderboard"
                onAction={onHide}
                disabled={busy}
                icon={<EyeOff size={18} aria-hidden="true" />}
              >
                Hide from participants
              </ActionButton>
            ) : (
              <>
                <ActionButton
                  variant="ghost"
                  preview="Closing the leaderboard"
                  onAction={onClose}
                  className="bg-surface-low"
                  icon={<ArrowLeft size={18} aria-hidden="true" />}
                >
                  Back to question result
                </ActionButton>
                <ActionButton
                  preview="Showing the leaderboard"
                  onAction={onShow}
                  disabled={busy}
                  icon={<MonitorUp size={18} aria-hidden="true" />}
                >
                  Show to participants
                </ActionButton>
              </>
            )}
          </div>
        </div>

        <LeaderboardTable board={board} />

        <Text variant="caption" tone="secondary">
          Tied scores share a rank. The next question is always your choice;
          nothing advances automatically.
        </Text>
      </Surface>
    </div>
  );
}

/** What participants see while the host shows the leaderboard. */
export function ParticipantLeaderboard({
  board,
  standing,
  participantId,
}: {
  board: LeaderboardDto;
  standing: ParticipantStandingDto | null;
  participantId: string;
}) {
  const tenth = board.entries.at(-1)?.score;
  const inTop = board.entries.some((entry) => entry.userId === participantId);
  const gap =
    standing && !inTop && tenth !== undefined
      ? Math.max(tenth - standing.totalScore, 0)
      : null;
  return (
    <ParticipantStage className="justify-start md:py-space-2xl">
      <div className="flex w-full max-w-2xl flex-col gap-space-md">
        <div className="space-y-space-xs">
          <Badge variant="live" label="Leaderboard from the host" />
          <Text as="h1" variant="page-title">
            Leaderboard — Top 10
          </Text>
          <Text tone="secondary">
            {afterLabel(board)}. Tied scores share a rank.
          </Text>
        </div>

        <LeaderboardTable board={board} highlightUserId={participantId} />

        <Surface
          as="section"
          aria-labelledby="your-standing"
          className="space-y-space-sm"
        >
          <div className="flex flex-wrap items-center justify-between gap-space-xs">
            <Text as="h2" id="your-standing" variant="card-title">
              Your standing
            </Text>
            {inTop ? (
              <Badge variant="live" dot={false} label="In the top 10" />
            ) : gap !== null ? (
              <Text variant="caption" tone="secondary">
                {gap.toLocaleString()} pts behind the top 10
              </Text>
            ) : null}
          </div>
          {standing ? (
            <div className="grid grid-cols-1 gap-space-sm sm:grid-cols-2">
              <StatTile
                label="Your rank"
                icon={<Medal size={20} />}
                value={`#${standing.rank}`}
                suffix={`of ${standing.participantCount.toLocaleString()}`}
              />
              <StatTile
                label="Total score"
                icon={<Star size={20} />}
                value={standing.totalScore.toLocaleString()}
                suffix="pts"
              />
            </div>
          ) : (
            <Text variant="body-secondary" tone="secondary">
              Your rank appears after you take part in a question.
            </Text>
          )}
        </Surface>

        <StatusStrip
          icon={
            <span className="ds-live-dot block size-status-dot rounded-pill bg-accent" />
          }
          title="Waiting for the host to continue…"
        />
      </div>
    </ParticipantStage>
  );
}
