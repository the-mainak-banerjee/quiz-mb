'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { QUESTION_TYPE, QUIZ_STATUS, type QuizDto } from '@quizmb/contracts';
import { NavigationItem } from '@/components/workspace/navigation-item';
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Info,
  Lightbulb,
  Pencil,
  ShieldCheck,
  UsersRound,
} from 'lucide-react';
import { Badge, Button, GlobalLoader, Surface, Text } from '@/components/ui';
import { QUESTION_LABELS } from '@/features/quiz-builder/question-form';
import { APP_LINKS } from '@/config/navigation';
import { apiError } from '@/lib/api/client';
import { publishingApi } from '@/lib/api/publishing';
import { pluralize } from '@/lib/utils';
import { PromptText } from '@/components/markdown-preview';
import { LocalDateTime } from '@/components/local-date-time';

export function ReviewPublishPanel({
  quiz,
  project,
  valid,
  onBack,
}: {
  quiz: QuizDto;
  project: { id: string; name: string };
  valid: boolean;
  onBack: () => void;
}) {
  const router = useRouter();
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState('');
  // Edits to a published quiz are saved as they are made; there is nothing
  // left to publish.
  const published = quiz.status !== QUIZ_STATUS.DRAFT;
  const scored = quiz.questions.filter(
    (question) => question.type !== QUESTION_TYPE.DESCRIPTIVE,
  );
  const totalSeconds = quiz.questions.reduce(
    (sum, question) =>
      sum +
      (question.durationOverrideSeconds ?? quiz.defaultQuestionDurationSeconds),
    0,
  );
  const planned = quiz.plannedStartAt ? (
    <LocalDateTime value={quiz.plannedStartAt} format="fullDateTime" />
  ) : (
    'Not scheduled'
  );

  return (
    <div className="space-y-space-lg">
      {publishing && (
        <GlobalLoader
          label="Publishing your quiz…"
          hint="Opening registration and preparing the public page."
        />
      )}
      <Surface className="flex flex-col justify-between gap-space-md bg-action-secondary sm:flex-row sm:items-center">
        <div className="flex items-start gap-space-sm">
          <CheckCircle2
            className="shrink-0 text-accent"
            size={26}
            aria-hidden="true"
          />
          <div>
            <div className="flex flex-wrap items-center gap-space-xs">
              <Text as="h2" variant="section-heading">
                {published
                  ? 'Published'
                  : valid
                    ? 'Ready for publication'
                    : 'Complete your quiz before publishing'}
              </Text>
              <Badge
                variant={valid ? 'scheduled' : 'draft'}
                label={valid ? 'Validated' : 'Needs attention'}
              />
            </div>
            <Text variant="body-secondary" tone="secondary">
              {quiz.questions.length} question structures · {scored.length}{' '}
              scored · {quiz.questions.length - scored.length} descriptive
            </Text>
          </div>
        </div>
        <div className="rounded-control bg-surface px-space-sm py-space-xs text-right">
          <Text variant="caption" tone="secondary">
            VALIDATION CHECK
          </Text>
          <Text variant="label">
            {valid
              ? `Passed ${quiz.questions.length}/${quiz.questions.length}`
              : 'Review required'}
          </Text>
        </div>
      </Surface>

      <div className="grid items-start gap-gutter lg:grid-cols-12">
        <div className="space-y-space-md lg:col-span-7">
          <Surface className="space-y-space-md">
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <div>
                <Text as="h2" variant="section-heading">
                  Metadata & scope
                </Text>
                <Text variant="body-secondary" tone="secondary">
                  Confirm the participant-facing session details.
                </Text>
              </div>
              <Button
                variant="ghost"
                icon={<Pencil size={17} aria-hidden="true" />}
              >
                Edit details
              </Button>
            </div>
            <dl className="grid gap-space-sm sm:grid-cols-2">
              {[
                { label: 'Project', value: project.name, Icon: ShieldCheck },
                {
                  label: 'Quiz session title',
                  value: quiz.title,
                  Icon: CheckCircle2,
                },
                {
                  label: 'Total questions',
                  value: `${quiz.questions.length} modules`,
                  Icon: Check,
                },
                {
                  label: 'Timing standard',
                  value: `${quiz.defaultQuestionDurationSeconds}s per question`,
                  Icon: Clock3,
                },
                {
                  label: 'Room limit',
                  value: `${quiz.registrationLimit} ${pluralize(quiz.registrationLimit, 'seat')}`,
                  Icon: UsersRound,
                },
                {
                  label: 'Broadcast window',
                  value: planned,
                  Icon: CalendarDays,
                },
              ].map(({ label, value, Icon }) => (
                <div
                  key={label}
                  className="rounded-control bg-surface-low p-space-sm"
                >
                  <dt className="flex items-center gap-space-xs text-caption text-text-secondary">
                    <Icon size={16} aria-hidden="true" />
                    {label}
                  </dt>
                  <dd className="mt-space-xs text-label text-text-primary">
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="flex items-start gap-space-sm rounded-control bg-status-scheduled-surface p-space-sm">
              <Info
                className="shrink-0 text-status-scheduled-text"
                size={18}
                aria-hidden="true"
              />
              <div>
                <Text variant="label" className="text-status-scheduled-text">
                  Host-controlled launch
                </Text>
                <Text
                  variant="body-secondary"
                  className="text-status-scheduled-text"
                >
                  Publishing opens registration and reserves the planned slot.
                  It does not start the live room.
                </Text>
              </div>
            </div>
          </Surface>

          <Surface className="space-y-space-md">
            <div className="flex flex-wrap items-center justify-between gap-space-sm">
              <div>
                <Text as="h2" variant="section-heading">
                  Content inventory
                </Text>
                <Text variant="body-secondary" tone="secondary">
                  {quiz.questions.length} staged questions · {totalSeconds}{' '}
                  seconds total
                </Text>
              </div>
              <Button
                variant="ghost"
                icon={<Pencil size={17} aria-hidden="true" />}
                onClick={onBack}
              >
                Edit
              </Button>
            </div>
            <ol className="divide-y divide-border-surface">
              {quiz.questions.map((question, index) => {
                const correct = question.options.filter(
                  (option) => option.isCorrect,
                ).length;
                return (
                  <li
                    key={question.id}
                    className="flex gap-space-sm py-space-sm first:pt-0 last:pb-0"
                  >
                    <div className="flex size-control shrink-0 items-center justify-center rounded-control bg-action-secondary text-label text-accent">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <div className="min-w-0 flex-1">
                      <PromptText
                        text={question.text}
                        compact
                        className="text-label text-text-primary"
                      />
                      <Text variant="caption" tone="secondary">
                        {QUESTION_LABELS[question.type]} ·{' '}
                        {question.type === QUESTION_TYPE.DESCRIPTIVE
                          ? 'Unscored'
                          : `${question.options.length} options · ${correct} correct`}{' '}
                        ·{' '}
                        {question.durationOverrideSeconds ??
                          quiz.defaultQuestionDurationSeconds}
                        s
                      </Text>
                    </div>
                    <CheckCircle2
                      className="shrink-0 text-accent"
                      size={18}
                      aria-label="Validated"
                    />
                  </li>
                );
              })}
            </ol>
          </Surface>
        </div>

        <aside className="space-y-space-md lg:col-span-5">
          <Surface className="space-y-space-md">
            <Text as="h2" variant="section-heading">
              Diagnostics
            </Text>
            {[
              [
                'Timer verification',
                'Every question has a valid response window.',
              ],
              [
                'Scoring architecture',
                'Choice questions contain valid answer keys.',
              ],
              [
                'Content completeness',
                'No blank prompts or missing required answers.',
              ],
            ].map(([title, description]) => (
              <div key={title} className="flex items-start gap-space-sm">
                <CheckCircle2
                  className="shrink-0 text-accent"
                  size={18}
                  aria-hidden="true"
                />
                <div>
                  <Text variant="label">{title}</Text>
                  <Text variant="caption" tone="secondary">
                    {description}
                  </Text>
                </div>
              </div>
            ))}
          </Surface>
          <Surface className="flex items-start gap-space-sm bg-surface-low">
            <Lightbulb className="shrink-0 text-accent" aria-hidden="true" />
            <div>
              <Text variant="label">Pre-broadcast recommendation</Text>
              <Text variant="body-secondary" tone="secondary">
                Join five minutes early to verify the participant lobby before
                Question 1.
              </Text>
            </div>
          </Surface>
        </aside>
      </div>

      <div className="flex flex-col-reverse justify-between gap-space-sm border-t border-border-surface pt-space-md sm:flex-row sm:items-center">
        <Button
          variant="secondary"
          icon={<ArrowLeft size={18} aria-hidden="true" />}
          onClick={onBack}
        >
          Back to questions
        </Button>
        {published ? (
          <NavigationItem
            href={APP_LINKS.WORKSPACE.MANAGE_QUIZ(quiz.id)}
            icon={<ArrowRight size={18} aria-hidden="true" />}
            iconPosition="right"
            className="bg-action-primary text-action-on-primary hover:bg-action-primary-hover hover:text-action-on-primary"
          >
            Back to manage quiz
          </NavigationItem>
        ) : (
          <div className="space-y-space-xs text-right">
            <Button
              disabled={!valid || !quiz.plannedStartAt || publishing}
              icon={<ArrowRight size={18} aria-hidden="true" />}
              iconPosition="right"
              onClick={async () => {
                setPublishing(true);
                setPublishError('');
                try {
                  await publishingApi.publish(quiz.id);
                  router.push(APP_LINKS.WORKSPACE.MANAGE_QUIZ(quiz.id));
                } catch (cause) {
                  setPublishError(apiError(cause).message);
                  setPublishing(false);
                }
              }}
            >
              {publishing ? 'Publishing…' : 'Publish quiz'}
            </Button>
            {publishError && (
              <Text role="alert" variant="caption" className="text-danger">
                {publishError}
              </Text>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
