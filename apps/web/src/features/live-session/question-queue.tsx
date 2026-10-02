'use client';

import type { ReactNode } from 'react';
import { CircleCheck, ListChecks, Lock, LockKeyhole } from 'lucide-react';
import { Badge, Callout, Surface, Text } from '@/components/ui';
import { cn } from '@/lib/utils';
import { questionNumber, questionTypeLabels } from './format';
import type { QueueQuestion } from './types';

const statusLabels = {
  available: 'Available',
  selected: 'Selected',
  active: 'Live',
  asked: 'Done',
  locked: 'Locked',
} as const;

function StatusMark({ question }: { question: QueueQuestion }) {
  const label = statusLabels[question.state];
  const icons: Partial<Record<QueueQuestion['state'], ReactNode>> = {
    selected: <CircleCheck size={14} aria-hidden="true" />,
    asked: <CircleCheck size={14} aria-hidden="true" />,
    locked: <Lock size={13} aria-hidden="true" />,
  };
  return (
    <Text
      as="span"
      variant="caption"
      className={cn(
        'inline-flex items-center gap-1 font-semibold',
        question.state === 'locked' || question.state === 'available'
          ? 'text-text-secondary'
          : 'text-accent',
      )}
    >
      {question.state === 'active' && (
        <span
          aria-hidden="true"
          className="ds-live-dot size-status-dot rounded-pill bg-accent"
        />
      )}
      {icons[question.state]}
      {label}
    </Text>
  );
}

function QueueItemBody({ question }: { question: QueueQuestion }) {
  const muted = question.state === 'asked' || question.state === 'locked';
  return (
    <>
      <span className="flex items-center justify-between gap-space-xs">
        <Text
          as="span"
          variant="label"
          tone={muted ? 'secondary' : 'primary'}
          className={cn(question.state === 'active' && 'font-bold')}
        >
          {questionNumber(question.position)}
        </Text>
        <StatusMark question={question} />
      </span>
      <Text
        as="span"
        variant="body-secondary"
        tone={muted ? 'secondary' : 'primary'}
        className="line-clamp-2 font-medium"
      >
        {question.text}
      </Text>
      <Text
        as="span"
        variant="caption"
        className={cn(
          question.state === 'active' ? 'text-accent' : 'text-text-secondary',
        )}
      >
        {questionTypeLabels[question.type]} · {question.durationSeconds}s
        {question.state === 'active' && ' · In progress'}
      </Text>
    </>
  );
}

/** Host question list; available questions can be chosen in any order. */
export function QuestionQueue({
  questions,
  onSelect,
  defaultDurationSeconds,
}: {
  questions: QueueQuestion[];
  /** Present between questions; omitted while a question is live. */
  onSelect?: (questionId: string) => void;
  defaultDurationSeconds: number;
}) {
  const liveQuestion = questions.some(
    (question) => question.state === 'active',
  );
  return (
    <Surface as="section" className="flex flex-col gap-space-sm">
      <div className="flex items-center justify-between gap-space-xs">
        <Text
          as="h2"
          variant="card-title"
          className="flex items-center gap-space-xs"
        >
          <ListChecks size={18} aria-hidden="true" className="text-accent" />
          Questions
        </Text>
        <Badge variant="draft" label={String(questions.length)} />
      </div>
      {liveQuestion ? (
        <Callout icon={<LockKeyhole size={16} aria-hidden="true" />}>
          A question is live. The list unlocks when its timer ends.
        </Callout>
      ) : (
        <Text variant="caption" tone="secondary">
          Choose any order. Select an available question to preview it before
          asking.
        </Text>
      )}

      <ul className="-mr-1 flex flex-col gap-1.5 pr-1 lg:max-h-160 lg:overflow-y-auto">
        {questions.map((question) => {
          const selectable =
            onSelect &&
            (question.state === 'available' || question.state === 'selected');
          const itemClass = cn(
            'relative flex w-full flex-col gap-1 rounded-control p-3 text-left',
            question.state === 'available' &&
              'border border-border-surface bg-surface',
            question.state === 'selected' &&
              'border-2 border-accent bg-surface shadow-card',
            question.state === 'active' &&
              'bg-status-live-surface pl-4 shadow-card before:absolute before:inset-y-2 before:left-0 before:w-1 before:rounded-r-sm before:bg-accent',
            question.state === 'asked' && 'bg-surface-low opacity-80',
            question.state === 'locked' &&
              'cursor-not-allowed bg-surface-low opacity-60',
          );
          return (
            <li key={question.id}>
              {selectable ? (
                <button
                  type="button"
                  aria-pressed={question.state === 'selected'}
                  onClick={() => onSelect(question.id)}
                  className={cn(
                    itemClass,
                    'ds-focus ds-control-motion cursor-pointer hover:border-accent',
                  )}
                >
                  <QueueItemBody question={question} />
                </button>
              ) : (
                <div
                  className={itemClass}
                  aria-current={
                    question.state === 'active' ? 'step' : undefined
                  }
                >
                  <QueueItemBody question={question} />
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Text
        variant="caption"
        tone="secondary"
        className="border-t border-border-surface pt-space-xs"
      >
        Default timer {defaultDurationSeconds}s · No autoplay
      </Text>
    </Surface>
  );
}
