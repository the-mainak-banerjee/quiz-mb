import {
  CircleX,
  Eye,
  EyeOff,
  Flag,
  MonitorUp,
  Trophy,
  UsersRound,
} from 'lucide-react';
import {
  Avatar,
  Badge,
  Callout,
  ProgressBar,
  Surface,
  Text,
} from '@/components/ui';
import { ActionButton } from './action-button';
import { percentOf } from './format';
import { LateJoinToggle } from './late-join-toggle';
import type { LiveParticipant } from './types';

const PRESENCE_PREVIEW = 23;

/** Connected participants, optional live turnout and the late-join control. */
export function ParticipantsPanel({
  participants,
  connected,
  registered,
  submitted,
  allowLateJoin,
  onLateJoinChange,
}: {
  participants: LiveParticipant[];
  connected: number;
  registered: number;
  /** Present while a question is live. */
  submitted?: number | undefined;
  allowLateJoin: boolean;
  onLateJoinChange?: ((allowed: boolean) => void) | undefined;
}) {
  const live = submitted !== undefined;
  const shown = participants.slice(0, PRESENCE_PREVIEW);
  return (
    <Surface as="section" className="flex flex-col gap-space-sm">
      <div className="flex items-center justify-between gap-space-xs">
        <Text
          as="h2"
          variant="card-title"
          className="flex items-center gap-space-xs"
        >
          <UsersRound size={18} aria-hidden="true" className="text-accent" />
          Participants
        </Text>
        <Badge variant="live" label={`${connected} live`} />
      </div>
      <p className="flex flex-wrap items-baseline gap-x-space-xs">
        <span className="text-display text-text-primary">{connected}</span>
        <Text as="span" tone="secondary">
          connected
        </Text>
        <Text as="span" variant="caption" tone="secondary">
          · {registered} registered
        </Text>
      </p>

      {live && (
        <div className="space-y-space-xs rounded-control bg-surface-low p-3">
          <div className="flex items-center justify-between gap-space-xs">
            <Text as="span" variant="caption" tone="secondary">
              Live turnout
            </Text>
            <Text as="span" variant="label" className="text-accent">
              {submitted} / {connected} submitted (
              {percentOf(submitted, connected)}%)
            </Text>
          </div>
          <ProgressBar
            value={submitted}
            max={connected}
            label="Participants who submitted"
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-caption text-text-secondary">
          {live ? (
            <>
              <span className="flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-pill bg-accent"
                />
                Submitted ({submitted})
              </span>
              <span className="flex items-center gap-1">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-pill bg-border-control"
                />
                Waiting ({connected - submitted})
              </span>
            </>
          ) : (
            <span className="font-semibold tracking-wider uppercase">
              In the room
            </span>
          )}
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {shown.map((participant) => (
            <li key={participant.id}>
              <Avatar
                name={participant.name}
                size="small"
                tone="neutral"
                status={!live || participant.submitted ? 'positive' : 'neutral'}
                title={participant.name}
              />
            </li>
          ))}
          {connected > shown.length && (
            <li className="flex size-7 items-center justify-center rounded-pill bg-surface-low text-caption text-text-secondary">
              +{connected - shown.length}
            </li>
          )}
        </ul>
      </div>

      <LateJoinToggle
        layout="panel"
        initialAllowed={allowLateJoin}
        onAllowedChange={onLateJoinChange}
        description="Registered participants can still join"
      />
    </Surface>
  );
}

/** Host-controlled leaderboard visibility. */
/**
 * Leaderboard controls: a host-only view, or showing the top 10 on every
 * participant screen. Available between questions once one has ended.
 */
export function LeaderboardPanel({
  canShowParticipants,
  shown = false,
  busy = false,
  onView,
  onShow,
  onHide,
}: {
  canShowParticipants: boolean;
  shown?: boolean;
  busy?: boolean;
  onView?: (() => void) | undefined;
  onShow?: (() => void) | undefined;
  onHide?: (() => void) | undefined;
}) {
  return (
    <Surface as="section" className="flex flex-col gap-space-sm">
      <div className="flex items-center justify-between gap-space-xs">
        <Text
          as="h2"
          variant="card-title"
          className="flex items-center gap-space-xs"
        >
          <Trophy size={18} aria-hidden="true" className="text-accent" />
          Leaderboard
        </Text>
        <Badge
          variant={shown ? 'live' : 'draft'}
          label={shown ? 'Showing' : 'Hidden'}
        />
      </div>
      <Callout
        icon={
          shown ? (
            <MonitorUp size={16} aria-hidden="true" />
          ) : (
            <EyeOff size={16} aria-hidden="true" />
          )
        }
      >
        {shown
          ? 'Every participant screen shows the top 10. Hide it or ask the next question.'
          : 'Hidden from participants. Check standings privately or show the top 10 on every screen.'}
      </Callout>
      <div className="flex flex-col gap-2">
        <ActionButton
          preview="Viewing the leaderboard"
          onAction={onView}
          variant="secondary"
          className="w-full"
          disabled={!canShowParticipants || busy}
          icon={<Eye size={18} aria-hidden="true" />}
        >
          View leaderboard (host only)
        </ActionButton>
        {shown ? (
          <ActionButton
            preview="Hiding the leaderboard"
            onAction={onHide}
            variant="outline"
            className="w-full"
            disabled={busy}
            icon={<EyeOff size={18} aria-hidden="true" />}
          >
            Hide from participants
          </ActionButton>
        ) : (
          <ActionButton
            preview="Showing the leaderboard"
            onAction={onShow}
            variant="outline"
            className="w-full"
            disabled={!canShowParticipants || busy}
            icon={<MonitorUp size={18} aria-hidden="true" />}
          >
            Show to participants
          </ActionButton>
        )}
        {!canShowParticipants && (
          <Text variant="caption" tone="secondary" className="text-center">
            Available between questions
          </Text>
        )}
      </div>
    </Surface>
  );
}

/** Quiz progress and the End Quiz action. */
export function QuizProgressPanel({
  asked,
  questionCount,
  questionLive,
  onEndQuiz,
}: {
  asked: number;
  questionCount: number;
  questionLive: boolean;
  onEndQuiz?: (() => void) | undefined;
}) {
  return (
    <Surface as="section" className="flex flex-col gap-space-sm">
      <Text
        as="h2"
        variant="card-title"
        className="flex items-center gap-space-xs"
      >
        <Flag size={18} aria-hidden="true" className="text-text-secondary" />
        Quiz progress
      </Text>
      <dl className="flex flex-col gap-1 text-body-secondary text-text-secondary">
        <div className="flex justify-between">
          <dt>Questions asked</dt>
          <dd className="font-semibold text-text-primary">{asked}</dd>
        </div>
        <div className="flex justify-between">
          <dt>Questions remaining</dt>
          <dd className="font-semibold text-text-primary">
            {questionCount - asked}
          </dd>
        </div>
      </dl>
      <ActionButton
        onAction={onEndQuiz}
        preview="Ending the quiz"
        variant="outline"
        className="w-full border-danger-surface text-danger enabled:hover:border-danger enabled:hover:bg-danger-surface"
        icon={<CircleX size={18} aria-hidden="true" />}
      >
        End quiz
      </ActionButton>
      <Text variant="caption" tone="secondary" className="text-center">
        {questionLive
          ? 'Ending now closes the live question. Missing answers count as not attempted.'
          : `Final results use only the ${asked} questions asked so far.`}
      </Text>
    </Surface>
  );
}
