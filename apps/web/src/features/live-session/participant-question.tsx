'use client';

import { useId, useState, type FormEvent, type ReactNode } from 'react';
import Image from 'next/image';
import {
  Check,
  Info,
  LoaderCircle,
  LockKeyhole,
  Medal,
  Send,
  Star,
  TimerOff,
  UserRound,
  X,
  Zap,
} from 'lucide-react';
import { ANSWER_LIMITS, ANSWER_STATUS, QUESTION_TYPE } from '@quizmb/contracts';
import MarkdownPreview from '@/components/markdown-preview';
import { Badge, Button, Callout, Surface, Text } from '@/components/ui';
import { Choice } from '@/components/ui/choice';
import { Textarea } from '@/components/ui/textarea';
import { VisuallyHidden } from '@/components/visually-hidden';
import { cn } from '@/lib/utils';
import { percentOf, questionTypeLabels } from './format';
import { ParticipantStage } from './participant-screens';
import { OptionLetter, QuestionChip, TimerPill } from './question-parts';
import { StatTile } from './stat-tile';
import type {
  ParticipantOption,
  ParticipantQuestion,
  ParticipantQuestionPhase,
  ParticipantQuestionResult,
  ParticipantStanding,
  SubmittedAnswer,
} from './types';

type OptionTone = 'idle' | 'selected' | 'muted' | 'correct' | 'incorrect';

const optionTones: Record<OptionTone, string> = {
  idle: 'border-border-surface bg-surface-low hover:border-border-control',
  selected: 'border-accent bg-status-live-surface shadow-card',
  muted: 'border-transparent bg-surface-low text-text-secondary',
  correct: 'border-accent bg-status-live-surface shadow-card',
  incorrect: 'border-danger bg-danger-surface',
};

/** One answer option row; the consumer decides its element and state. */
function OptionRow({
  as: Tag = 'div',
  tone,
  marker,
  trailing,
  children,
}: {
  as?: 'div' | 'label' | 'li';
  tone: OptionTone;
  marker: ReactNode;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Tag
      className={cn(
        'ds-control-motion flex min-h-control items-start gap-space-sm rounded-control border p-space-sm',
        Tag === 'label' && 'cursor-pointer',
        optionTones[tone],
      )}
    >
      {marker}
      <div className="flex min-w-0 flex-1 flex-col gap-space-xs">
        {children}
      </div>
      {trailing}
    </Tag>
  );
}

/** Small pill naming an option's role: your answer or the correct one. */
function OptionTag({
  tone,
  icon,
  children,
}: {
  tone: 'mine' | 'correct' | 'wrong';
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Text
      as="span"
      variant="caption"
      className={cn(
        'inline-flex items-center gap-1 rounded-pill px-badge-x py-badge-y font-semibold',
        tone === 'mine' && 'bg-action-primary text-action-on-primary',
        tone === 'correct' && 'bg-accent text-action-on-primary',
        tone === 'wrong' && 'bg-danger text-action-on-primary',
      )}
    >
      {icon}
      {children}
    </Text>
  );
}

/** Round marker replacing the option letter once the answer is revealed. */
function ResultMarker({ correct }: { correct: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-pill text-action-on-primary',
        correct ? 'bg-accent' : 'bg-danger',
      )}
    >
      {correct ? <Check size={14} /> : <X size={14} />}
    </span>
  );
}

function OptionText({ children }: { children: ReactNode }) {
  return <Text className="break-words">{children}</Text>;
}

/** Selectable options while the question accepts answers. */
function AnswerChoices({
  question,
  selected,
  onToggle,
}: {
  question: ParticipantQuestion;
  selected: string[];
  onToggle: (optionId: string, checked: boolean) => void;
}) {
  const multiple = question.type === QUESTION_TYPE.MULTIPLE_CHOICE;
  return (
    <fieldset className="flex flex-col gap-space-sm">
      <VisuallyHidden as="legend">
        {multiple ? 'Select all answers that apply' : 'Select one answer'}
      </VisuallyHidden>
      {question.options.map((option, index) => {
        const checked = selected.includes(option.id);
        return (
          <OptionRow
            key={option.id}
            as="label"
            tone={checked ? 'selected' : 'idle'}
            marker={<OptionLetter index={index} emphasized={checked} />}
            trailing={
              <Choice
                type={multiple ? 'checkbox' : 'radio'}
                name={`answer-${question.askedQuestionId}`}
                value={option.id}
                checked={checked}
                onChange={(event) => onToggle(option.id, event.target.checked)}
                className="mt-1"
              />
            }
          >
            <OptionText>{option.text}</OptionText>
          </OptionRow>
        );
      })}
    </fieldset>
  );
}

/** Options after submission or expiry; the reveal adds correctness. */
function LockedChoices({
  options,
  mine,
  result,
}: {
  options: ParticipantOption[];
  mine: string[];
  result?: ParticipantQuestionResult | undefined;
}) {
  const total = result
    ? Object.values(result.distribution).reduce((sum, n) => sum + n, 0)
    : 0;
  return (
    <ul className="flex flex-col gap-space-sm" aria-label="Answer options">
      {options.map((option, index) => {
        const chosen = mine.includes(option.id);
        const correct = result?.correctOptionIds.includes(option.id) ?? false;
        let tone: OptionTone = chosen ? 'selected' : 'muted';
        if (result) {
          tone = correct ? 'correct' : chosen ? 'incorrect' : 'muted';
        }
        const tags = (
          <>
            {chosen && (
              <OptionTag
                tone={result && !correct ? 'wrong' : 'mine'}
                icon={
                  result ? (
                    <UserRound size={12} aria-hidden="true" />
                  ) : (
                    <LockKeyhole size={12} aria-hidden="true" />
                  )
                }
              >
                Your answer
              </OptionTag>
            )}
            {correct && (
              <OptionTag
                tone="correct"
                icon={<Check size={12} aria-hidden="true" />}
              >
                Correct answer
              </OptionTag>
            )}
          </>
        );
        return (
          <OptionRow
            key={option.id}
            as="li"
            tone={tone}
            marker={
              result && (correct || chosen) ? (
                <ResultMarker correct={correct} />
              ) : (
                <OptionLetter index={index} emphasized={chosen && !result} />
              )
            }
            trailing={
              result && (
                <Text
                  as="span"
                  variant="caption"
                  tone="secondary"
                  className="mt-0.5 shrink-0 font-semibold"
                >
                  {percentOf(result.distribution[option.id] ?? 0, total)}%
                  <VisuallyHidden> of participants picked this</VisuallyHidden>
                </Text>
              )
            }
          >
            <OptionText>{option.text}</OptionText>
            {(chosen || correct) && (
              <div className="flex flex-wrap gap-space-xs">{tags}</div>
            )}
          </OptionRow>
        );
      })}
    </ul>
  );
}

/** The participant's own descriptive response, read-only. */
function LockedResponse({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-space-xs">
      <Text variant="label" className="flex items-center gap-1">
        <LockKeyhole size={14} aria-hidden="true" className="text-accent" />
        Your response
      </Text>
      <Text className="rounded-control bg-surface-low p-space-sm break-words whitespace-pre-wrap">
        {text}
      </Text>
    </div>
  );
}

/** Correct / incorrect / not attempted outcome shown at the reveal. */
function ResultBanner({
  result,
  descriptive,
  showPoints,
}: {
  result: ParticipantQuestionResult;
  descriptive: boolean;
  showPoints: boolean;
}) {
  const attempted = result.status === ANSWER_STATUS.SUBMITTED;
  const outcome = !attempted
    ? {
        tone: 'neutral',
        icon: <TimerOff size={20} />,
        title: 'Not attempted',
        detail: 'No answer was submitted before the timer ended.',
      }
    : descriptive
      ? {
          tone: 'positive',
          icon: <Check size={20} />,
          title: 'Response recorded',
          detail: 'Descriptive answers are not scored.',
        }
      : result.isCorrect
        ? {
            tone: 'positive',
            icon: <Check size={20} />,
            title: 'Correct',
            detail: 'Faster correct answers earn more points.',
          }
        : {
            tone: 'negative',
            icon: <X size={20} />,
            title: 'Incorrect',
            detail: 'The correct answer is highlighted below.',
          };
  return (
    <div
      className={cn(
        'flex items-center gap-space-sm rounded-control p-space-sm',
        outcome.tone === 'positive' && 'bg-status-live-surface',
        outcome.tone === 'negative' && 'bg-danger-surface',
        outcome.tone === 'neutral' && 'bg-surface-high',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex size-10 shrink-0 items-center justify-center rounded-pill',
          outcome.tone === 'positive' &&
            'bg-action-primary text-action-on-primary',
          outcome.tone === 'negative' && 'bg-danger text-action-on-primary',
          outcome.tone === 'neutral' && 'bg-surface text-text-secondary',
        )}
      >
        {outcome.icon}
      </span>
      <div className="min-w-0 flex-1">
        <Text
          variant="card-title"
          className={cn(
            outcome.tone === 'negative' && 'text-danger-on-surface',
          )}
        >
          {outcome.title}
        </Text>
        <Text variant="body-secondary" tone="secondary">
          {outcome.detail}
        </Text>
      </div>
      {showPoints && (
        <div className="shrink-0 rounded-control bg-surface px-space-sm py-space-xs text-right">
          <Text as="span" variant="caption" tone="secondary" className="block">
            Points
          </Text>
          <Text as="span" variant="section-heading">
            +{result.pointsAwarded.toLocaleString()}
          </Text>
        </div>
      )}
    </div>
  );
}

/** Live status line at the foot of the question card. */
export function StatusStrip({
  tone = 'neutral',
  icon,
  title,
  detail,
}: {
  tone?: 'neutral' | 'positive';
  icon: ReactNode;
  title: string;
  detail?: string;
}) {
  return (
    <div
      role="status"
      className={cn(
        'flex items-center gap-space-sm rounded-control p-space-sm',
        tone === 'positive' ? 'bg-status-live-surface' : 'bg-surface-low',
      )}
    >
      <span aria-hidden="true" className="shrink-0 text-accent">
        {icon}
      </span>
      <div className="min-w-0">
        <Text variant="label">{title}</Text>
        {detail && (
          <Text variant="caption" tone="secondary">
            {detail}
          </Text>
        )}
      </div>
    </div>
  );
}

function StandingPlaceholder({ children }: { children: string }) {
  return (
    <Text
      as="span"
      variant="caption"
      tone="secondary"
      className="flex items-center gap-1"
    >
      <LoaderCircle
        size={14}
        aria-hidden="true"
        className="text-accent motion-safe:animate-spin"
      />
      {children}
    </Text>
  );
}

function SkeletonValue() {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-space-lg w-24 rounded-control bg-surface-high align-middle motion-safe:animate-pulse"
    />
  );
}

/** Total score and rank after the reveal; recalculating until standing arrives. */
function StandingTiles({
  standing,
  result,
  descriptive,
}: {
  standing: ParticipantStanding | null;
  result: ParticipantQuestionResult;
  descriptive: boolean;
}) {
  const loading = !standing;
  return (
    <section
      aria-label="Your score and rank"
      aria-live="polite"
      aria-busy={loading}
      className="grid grid-cols-1 gap-space-sm sm:grid-cols-2"
    >
      <StatTile
        label="Total score"
        icon={<Star size={20} />}
        value={
          standing ? standing.totalScore.toLocaleString() : <SkeletonValue />
        }
        suffix={standing ? 'pts' : undefined}
      >
        {loading ? (
          <StandingPlaceholder>Updating your score…</StandingPlaceholder>
        ) : descriptive ? (
          <Badge variant="draft" dot={false} label="Not scored" />
        ) : (
          <Badge
            variant={result.pointsAwarded > 0 ? 'live' : 'draft'}
            dot={false}
            label={`+${result.pointsAwarded.toLocaleString()} this question`}
          />
        )}
      </StatTile>
      <StatTile
        label="Your rank"
        icon={<Medal size={20} />}
        value={standing ? `#${standing.rank}` : <SkeletonValue />}
        suffix={
          standing
            ? `of ${standing.participantCount.toLocaleString()}`
            : undefined
        }
      >
        {loading ? (
          <StandingPlaceholder>Updating your rank…</StandingPlaceholder>
        ) : (
          <Text as="span" variant="caption" tone="secondary">
            Among ranked participants
          </Text>
        )}
      </StatTile>
    </section>
  );
}

function lockedAnswerOf(
  phase: ParticipantQuestionPhase,
): SubmittedAnswer | null {
  switch (phase.kind) {
    case 'answering':
      return null;
    case 'submitted':
      return phase.answer;
    case 'closed':
      return phase.answer;
    case 'revealed':
      return phase.result.status === ANSWER_STATUS.SUBMITTED
        ? {
            selectedOptionIds: phase.result.selectedOptionIds,
            answerText: phase.result.answerText,
          }
        : null;
  }
}

export type ParticipantQuestionViewProps = {
  question: ParticipantQuestion;
  phase: ParticipantQuestionPhase;
  /** Joined while this question was already running. */
  lateJoin?: boolean;
  submitting?: boolean;
  onSubmit?: (answer: SubmittedAnswer) => void;
  /** Why the last submission was refused, if it was. */
  error?: string | undefined;
  /** Preview seeding only; live drafts start empty. */
  defaultSelectedOptionIds?: string[];
  defaultAnswerText?: string;
};

/**
 * One asked question for a participant, from answering through the reveal.
 * The card stays in place across phases; only its state changes. Drafts are
 * local until Submit, and an unsubmitted draft is never shown as an answer.
 */
export function ParticipantQuestionView({
  question,
  phase,
  lateJoin = false,
  submitting = false,
  onSubmit,
  error,
  defaultSelectedOptionIds = [],
  defaultAnswerText = '',
}: ParticipantQuestionViewProps) {
  const headingId = useId();
  const responseId = useId();
  const counterId = useId();
  const [selected, setSelected] = useState(defaultSelectedOptionIds);
  const [text, setText] = useState(defaultAnswerText);

  const descriptive = question.type === QUESTION_TYPE.DESCRIPTIVE;
  const multiple = question.type === QUESTION_TYPE.MULTIPLE_CHOICE;
  const answering = phase.kind === 'answering';
  const timerRunning = phase.kind === 'answering' || phase.kind === 'submitted';
  const locked = lockedAnswerOf(phase);
  const result = phase.kind === 'revealed' ? phase.result : undefined;
  const canSubmit =
    answering &&
    !submitting &&
    (descriptive ? text.trim().length > 0 : selected.length > 0);

  function toggle(optionId: string, checked: boolean) {
    if (!multiple) return setSelected([optionId]);
    setSelected((current) =>
      checked
        ? [...current, optionId]
        : current.filter((id) => id !== optionId),
    );
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    onSubmit?.({
      selectedOptionIds: descriptive ? [] : selected,
      answerText: descriptive ? text.trim() : null,
    });
  }

  let body: ReactNode;
  if (answering && descriptive) {
    body = (
      <div className="flex flex-col gap-space-xs">
        <label htmlFor={responseId} className="text-label text-text-primary">
          Your response
        </label>
        <Textarea
          id={responseId}
          rows={6}
          maxLength={ANSWER_LIMITS.text}
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-describedby={counterId}
          placeholder="Type your answer…"
        />
        <Text
          id={counterId}
          variant="caption"
          tone="secondary"
          className="self-end"
        >
          {text.length.toLocaleString()} / {ANSWER_LIMITS.text.toLocaleString()}{' '}
          characters
        </Text>
      </div>
    );
  } else if (answering) {
    body = (
      <AnswerChoices
        question={question}
        selected={selected}
        onToggle={toggle}
      />
    );
  } else if (descriptive) {
    body = locked?.answerText ? (
      <LockedResponse text={locked.answerText} />
    ) : null;
  } else {
    body = (
      <LockedChoices
        options={question.options}
        mine={locked?.selectedOptionIds ?? []}
        result={result}
      />
    );
  }

  let footer: ReactNode;
  switch (phase.kind) {
    case 'answering':
      footer = (
        <div className="flex flex-col gap-space-sm sm:flex-row sm:items-center sm:justify-between">
          <Text
            variant="caption"
            tone="secondary"
            className="flex items-start gap-1"
          >
            <Info size={14} aria-hidden="true" className="mt-px shrink-0" />
            Your answer locks when you submit. A selection that isn&apos;t
            submitted doesn&apos;t count.
          </Text>
          <Button
            type="submit"
            size="hero"
            disabled={!canSubmit}
            icon={
              submitting ? (
                <LoaderCircle
                  size={18}
                  aria-hidden="true"
                  className="motion-safe:animate-spin"
                />
              ) : (
                <Send size={18} aria-hidden="true" />
              )
            }
            className="w-full sm:w-auto"
          >
            {submitting
              ? 'Submitting…'
              : multiple && selected.length > 0
                ? `Submit ${selected.length} ${selected.length === 1 ? 'answer' : 'answers'}`
                : 'Submit answer'}
          </Button>
        </div>
      );
      break;
    case 'submitted':
      footer = (
        <StatusStrip
          tone="positive"
          icon={<LockKeyhole size={20} />}
          title="Answer submitted and locked"
          detail="Waiting for the timer to end…"
        />
      );
      break;
    case 'closed':
      footer = (
        <StatusStrip
          icon={<LoaderCircle size={20} className="motion-safe:animate-spin" />}
          title={phase.answer ? "Time's up" : "Time's up · no answer submitted"}
          detail={descriptive ? 'Recording responses…' : 'Checking answers…'}
        />
      );
      break;
    case 'revealed':
      footer = (
        <StatusStrip
          icon={
            <span className="ds-live-dot block size-status-dot rounded-pill bg-accent" />
          }
          title="Waiting for the host to continue…"
        />
      );
      break;
  }

  return (
    <ParticipantStage className="justify-start md:py-space-2xl">
      <div className="flex w-full max-w-2xl flex-col gap-space-md">
        {lateJoin && timerRunning && (
          <Callout icon={<Zap size={16} aria-hidden="true" />}>
            <Text as="span" variant="label" className="block">
              You joined while this question was in progress
            </Text>
            You have only the time that&apos;s left. Questions asked before you
            joined count as not attempted.
          </Callout>
        )}

        <Surface
          as="section"
          aria-labelledby={headingId}
          className="flex flex-col gap-space-md sm:p-space-lg"
        >
          <div className="flex flex-wrap items-center justify-between gap-space-sm">
            <div className="flex flex-wrap items-center gap-2">
              <QuestionChip tone="strong">
                Question {question.number}
              </QuestionChip>
              <QuestionChip>{questionTypeLabels[question.type]}</QuestionChip>
              {multiple && (
                <QuestionChip tone="live">Select all that apply</QuestionChip>
              )}
              {descriptive && (
                <QuestionChip tone="live">Not scored</QuestionChip>
              )}
            </div>
            {timerRunning ? (
              <TimerPill
                remainingSeconds={phase.remainingSeconds}
                durationSeconds={question.durationSeconds}
              />
            ) : (
              <QuestionChip>
                <TimerOff size={14} aria-hidden="true" />
                Time&apos;s up
              </QuestionChip>
            )}
          </div>

          <div className="flex flex-col gap-space-sm">
            <VisuallyHidden as="h1" id={headingId}>
              Question {question.number}
            </VisuallyHidden>
            <MarkdownPreview
              text={question.text}
              className="text-section-heading md:text-page-title-mobile"
            />
            {question.imageUrl && (
              <Image
                unoptimized
                width={800}
                height={450}
                src={question.imageUrl}
                alt={`Image for question ${question.number}`}
                className="max-h-72 w-full rounded-control bg-surface-low object-contain"
              />
            )}
          </div>

          {result && (
            <ResultBanner
              result={result}
              descriptive={descriptive}
              showPoints={!descriptive}
            />
          )}

          <form onSubmit={submit} className="flex flex-col gap-space-md">
            {body}
            {error && answering && (
              <Callout
                role="alert"
                icon={<Info size={16} aria-hidden="true" />}
                className="bg-danger-surface text-danger-on-surface"
              >
                {error}
              </Callout>
            )}
            {footer}
          </form>
        </Surface>

        {phase.kind === 'revealed' && (
          <StandingTiles
            standing={phase.standing}
            result={phase.result}
            descriptive={descriptive}
          />
        )}
      </div>
    </ParticipantStage>
  );
}
