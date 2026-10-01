'use client';

import {
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { Eye, Info, ListChecks, Send, Timer } from 'lucide-react';
import { Badge, Button, Callout, Surface, Text } from '@/components/ui';
import { PreviewButton } from '@/components/workspace/preview-actions';
import { cn } from '@/lib/utils';
import { questionTypeLabels } from './format';
import { HostConsoleLayout } from './host-console-layout';
import { OptionLetter, QuestionChip } from './question-parts';
import { QuestionQueue } from './question-queue';
import type { HostQuestion, QueueQuestion } from './types';
import { QUESTION_TYPE } from '@quizmb/contracts';

function SelectedQuestionPreview({
  question,
  onDeselect,
  actionsRef,
}: {
  question: HostQuestion;
  onDeselect: () => void;
  actionsRef: RefObject<HTMLDivElement | null>;
}) {
  const descriptive = question.type === QUESTION_TYPE.DESCRIPTIVE;
  return (
    <Surface as="section" className="flex flex-col gap-space-sm sm:p-space-md">
      <div className="border-b border-border-surface pb-3">
        <Text
          variant="caption"
          className="font-bold tracking-wider text-accent uppercase"
        >
          Ready to ask
        </Text>
        <Text as="h2" variant="section-heading">
          Selected question preview
        </Text>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <QuestionChip tone="strong">
          Question {String(question.position).padStart(2, '0')}
        </QuestionChip>
        <QuestionChip>{questionTypeLabels[question.type]}</QuestionChip>
        <QuestionChip tone="live">
          <Timer size={14} aria-hidden="true" />
          {question.durationSeconds} seconds
        </QuestionChip>
      </div>

      <div className="rounded-control border border-border-surface bg-surface-low p-space-sm">
        <Text variant="card-title">{question.text}</Text>
      </div>

      {descriptive ? (
        <Callout icon={<Info size={16} aria-hidden="true" />}>
          Descriptive questions have no correct answer and award no points.
          Responses appear on your screen without participant names.
        </Callout>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between px-1 text-caption text-text-secondary">
            <span className="font-medium tracking-wide uppercase">
              Answer options
            </span>
            <span className="flex items-center gap-1 font-semibold text-accent">
              <Eye size={14} aria-hidden="true" />
              Host view only
            </span>
          </div>
          <ul className="flex flex-col gap-2.5">
            {question.options.map((option, index) => (
              <li
                key={option.id}
                className={cn(
                  'flex flex-col justify-between gap-2 rounded-control p-3 text-body-secondary sm:flex-row sm:items-center',
                  option.isCorrect
                    ? 'border-2 border-accent bg-status-live-surface'
                    : 'border border-border-surface bg-surface',
                )}
              >
                <span className="flex items-center gap-3">
                  <OptionLetter index={index} emphasized={option.isCorrect} />
                  <span
                    className={cn(
                      'text-text-primary',
                      option.isCorrect && 'font-medium',
                    )}
                  >
                    {option.text}
                  </span>
                </span>
                {option.isCorrect && (
                  <Badge
                    variant="live"
                    dot={false}
                    label="Correct answer"
                    className="shrink-0 self-start sm:self-auto"
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Callout icon={<Info size={18} aria-hidden="true" />}>
        Participants see this question only after you ask it. The{' '}
        {question.durationSeconds}s timer starts immediately on every device and
        cannot be stopped early.
      </Callout>

      <div
        ref={actionsRef}
        className="flex scroll-mb-space-md flex-col items-stretch gap-3 pt-2 sm:flex-row sm:items-center"
      >
        <PreviewButton
          action="Asking a question"
          size="hero"
          className="w-full sm:w-auto sm:flex-1"
          icon={<Send size={18} aria-hidden="true" />}
          iconPosition="right"
        >
          Ask question ({question.durationSeconds}s)
        </PreviewButton>
        <Button
          variant="ghost"
          className="h-control-large bg-surface-low"
          onClick={onDeselect}
        >
          Deselect
        </Button>
      </div>
    </Surface>
  );
}

/** LIVE_IDLE host console: pick any available question, preview, then ask. */
export function HostLiveIdle({
  header,
  questions,
  hostQuestions,
  defaultDurationSeconds,
  rail,
}: {
  header: ReactNode;
  questions: QueueQuestion[];
  /** Host-only question content, including answer keys, by question id. */
  hostQuestions: Record<string, HostQuestion>;
  defaultDurationSeconds: number;
  rail: ReactNode;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(
    questions.find((question) => question.state === 'selected')?.id ?? null,
  );
  const queue = questions.map((question) => ({
    ...question,
    state:
      question.state === 'asked'
        ? question.state
        : question.id === selectedId
          ? ('selected' as const)
          : ('available' as const),
  }));
  const selected = selectedId ? hostQuestions[selectedId] : undefined;
  const actionsRef = useRef<HTMLDivElement>(null);
  const scrollPending = useRef(false);

  // On stacked layouts the queue sits below the preview; bring the chosen
  // question's Ask button back into view after selecting it.
  useEffect(() => {
    if (!scrollPending.current || !selectedId) return;
    scrollPending.current = false;
    if (!window.matchMedia('(max-width: 1023px)').matches) return;
    const reduceMotion = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    actionsRef.current?.scrollIntoView({
      behavior: reduceMotion ? 'auto' : 'smooth',
      block: 'end',
    });
  }, [selectedId]);

  return (
    <HostConsoleLayout
      header={header}
      queue={
        <QuestionQueue
          questions={queue}
          defaultDurationSeconds={defaultDurationSeconds}
          onSelect={(id) => {
            scrollPending.current = id !== selectedId;
            setSelectedId(id === selectedId ? null : id);
          }}
        />
      }
      main={
        selected ? (
          <SelectedQuestionPreview
            question={selected}
            onDeselect={() => setSelectedId(null)}
            actionsRef={actionsRef}
          />
        ) : (
          <Surface className="flex flex-col items-center gap-space-xs py-space-xl text-center">
            <ListChecks size={24} aria-hidden="true" className="text-accent" />
            <Text as="h2" variant="card-title">
              No question selected
            </Text>
            <Text variant="body-secondary" tone="secondary">
              Choose any available question to preview it before asking.
            </Text>
          </Surface>
        )
      }
      rail={rail}
    />
  );
}
