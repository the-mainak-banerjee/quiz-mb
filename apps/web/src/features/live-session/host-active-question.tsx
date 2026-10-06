import {
  Check,
  Eye,
  LockKeyhole,
  MessagesSquare,
  Radio,
  Timer,
  TimerOff,
  UsersRound,
  Zap,
} from 'lucide-react';
import { Badge, Callout, ProgressBar, Surface, Text } from '@/components/ui';
import { cn } from '@/lib/utils';
import { PromptText } from '@/components/markdown-preview';
import { percentOf, questionTypeLabels } from './format';
import { OptionLetter, QuestionChip, TimerPill } from './question-parts';
import type { DescriptiveResponse, OptionResult, QueueQuestion } from './types';

type ActiveQuestionProps = {
  question: QueueQuestion;
  questionCount: number;
  remainingSeconds: number;
  submitted: number;
  connected: number;
  /** The question's timer has ended: show its final results. */
  ended?: boolean;
  /** No unused questions remain, so there is no next question to choose. */
  allAsked?: boolean;
} & (
  | { kind: 'scored'; results: OptionResult[] }
  | { kind: 'descriptive'; responses: DescriptiveResponse[] }
);

function AnswerBreakdown({
  results,
  submitted,
  ended,
}: {
  results: OptionResult[];
  submitted: number;
  ended: boolean;
}) {
  return (
    <div className="flex flex-col gap-space-sm">
      <div className="flex items-center justify-between gap-space-xs">
        <Text
          as="h3"
          variant="caption"
          className="font-bold tracking-wide uppercase"
        >
          {ended ? 'Final answer breakdown' : 'Live answer breakdown'}
        </Text>
        {!ended && (
          <Text
            variant="caption"
            tone="secondary"
            className="flex items-center gap-1"
          >
            <Eye size={14} aria-hidden="true" />
            Host only
          </Text>
        )}
      </div>
      <ul className="flex flex-col gap-space-sm">
        {results.map((result, index) => {
          const percent = percentOf(result.votes, submitted);
          return (
            <li
              key={result.id}
              className={cn(
                'relative isolate overflow-hidden rounded-control p-3.5',
                result.isCorrect
                  ? 'bg-status-live-surface shadow-card'
                  : 'bg-surface-low',
              )}
            >
              <span
                aria-hidden="true"
                className={cn(
                  'absolute inset-y-0 left-0 -z-10',
                  result.isCorrect
                    ? 'bg-action-secondary-hover'
                    : 'bg-surface-high',
                )}
                style={{ width: `${percent}%` }}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2.5">
                  <OptionLetter index={index} emphasized={result.isCorrect} />
                  <div className="flex min-w-0 flex-col gap-1">
                    <Text className={cn(result.isCorrect && 'font-semibold')}>
                      {result.text}
                    </Text>
                    {result.isCorrect && (
                      <Text
                        as="span"
                        variant="caption"
                        className="inline-flex items-center gap-1.5 self-start rounded-pill bg-accent px-2 py-0.5 text-action-on-primary"
                      >
                        <Check size={14} aria-hidden="true" />
                        {ended
                          ? 'Correct answer'
                          : 'Correct answer · hidden from participants'}
                      </Text>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <Text as="span" variant="label" className="block font-bold">
                    {percent}%
                  </Text>
                  <Text as="span" variant="caption" tone="secondary">
                    {result.votes} {result.votes === 1 ? 'vote' : 'votes'}
                  </Text>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <Callout icon={<LockKeyhole size={18} aria-hidden="true" />}>
        {ended
          ? 'Participants now see the correct answer, these final percentages and their own result.'
          : 'Live percentages and the correct answer are visible only to you. Participants see the options until the timer ends.'}
      </Callout>
    </div>
  );
}

function ResponseStream({
  responses,
  ended,
}: {
  responses: DescriptiveResponse[];
  ended: boolean;
}) {
  return (
    <Surface as="section" className="flex flex-col gap-space-sm">
      <div className="flex items-center justify-between gap-space-xs pb-space-xs">
        <Text
          as="h3"
          variant="card-title"
          className="flex items-center gap-space-xs"
        >
          <MessagesSquare
            size={20}
            aria-hidden="true"
            className="text-accent"
          />
          {ended ? 'Responses' : 'Live responses'}
        </Text>
        {ended ? (
          <Badge variant="draft" label="Final" />
        ) : (
          <Badge variant="live" label="Streaming live" />
        )}
      </div>
      <ol className="flex flex-col gap-space-sm pr-1 lg:max-h-110 lg:overflow-y-auto">
        {responses.map((response, index) => (
          <li key={response.id}>
            <article className="flex flex-col gap-2 rounded-control bg-surface-low p-space-sm">
              <div className="flex items-center justify-between text-caption text-text-secondary">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={cn(
                      'flex size-5 items-center justify-center rounded-pill text-caption font-semibold',
                      index === 0
                        ? 'bg-status-live-surface text-status-live-text'
                        : 'bg-surface-muted text-text-primary',
                    )}
                  >
                    {response.number}
                  </span>
                  <span className="font-semibold text-text-primary">
                    Response #{response.number}
                  </span>
                </span>
                <span
                  className={cn(
                    index === 0 &&
                      'flex items-center gap-1 font-medium text-accent',
                  )}
                >
                  {index === 0 && (
                    <span
                      aria-hidden="true"
                      className="size-status-dot rounded-pill bg-accent"
                    />
                  )}
                  {response.receivedLabel}
                </span>
              </div>
              <Text>“{response.text}”</Text>
            </article>
          </li>
        ))}
      </ol>
      <Callout icon={<Zap size={16} aria-hidden="true" />}>
        Responses arrive in real time without participant names. Descriptive
        questions are ungraded and do not affect points.
      </Callout>
    </Surface>
  );
}

/** QUESTION_ACTIVE host view for scored and descriptive questions. */
export function HostActiveQuestion(props: ActiveQuestionProps) {
  const {
    question,
    questionCount,
    remainingSeconds,
    submitted,
    connected,
    ended = false,
    allAsked = false,
  } = props;
  const scored = props.kind === 'scored';
  return (
    <>
      <Surface
        as="section"
        className="flex flex-col gap-space-md sm:p-space-lg"
      >
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <div className="flex flex-wrap items-center gap-2">
            <QuestionChip>
              Question {String(question.position).padStart(2, '0')} of{' '}
              {questionCount}
            </QuestionChip>
            <QuestionChip tone={scored ? 'neutral' : 'live'}>
              {scored
                ? questionTypeLabels[question.type]
                : 'Descriptive (ungraded)'}
            </QuestionChip>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <QuestionChip tone="strong">
              <Radio size={14} aria-hidden="true" />
              Host view
            </QuestionChip>
            {ended ? (
              <QuestionChip>
                <TimerOff size={14} aria-hidden="true" />
                Ended
              </QuestionChip>
            ) : (
              <TimerPill
                remainingSeconds={remainingSeconds}
                durationSeconds={question.durationSeconds}
              />
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Text
            variant="caption"
            className="font-bold tracking-wider text-accent uppercase"
          >
            {ended ? 'Completed question' : 'Live prompt'}
          </Text>
          <div role="heading" aria-level={2}>
            <PromptText
              text={question.text}
              className="text-page-title text-text-primary"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5 rounded-control bg-surface-low p-3">
          <div className="flex flex-wrap items-center justify-between gap-space-xs">
            <Text variant="label" className="flex items-center gap-2">
              <UsersRound
                size={18}
                aria-hidden="true"
                className="text-accent"
              />
              {submitted} submitted
              {connected > submitted && (
                <Text as="span" variant="body-secondary" tone="secondary">
                  · {connected - submitted}{' '}
                  {ended ? 'did not answer' : 'waiting'}
                </Text>
              )}
            </Text>
            <Text variant="label" className="text-accent">
              {percentOf(submitted, connected)}% participation
            </Text>
          </div>
          <ProgressBar
            value={submitted}
            max={connected}
            label="Connected participants who submitted"
          />
        </div>

        {props.kind === 'scored' && (
          <AnswerBreakdown
            results={props.results}
            submitted={submitted}
            ended={ended}
          />
        )}
      </Surface>

      {props.kind === 'descriptive' && (
        <ResponseStream responses={props.responses} ended={ended} />
      )}

      <Surface className="flex flex-col gap-2">
        <div
          role="status"
          className={cn(
            'flex h-control-large items-center justify-center gap-2 rounded-control px-space-md text-label tabular-nums',
            ended
              ? 'bg-surface-low text-text-primary'
              : 'bg-action-primary text-action-on-primary',
          )}
        >
          {ended ? (
            <TimerOff size={16} aria-hidden="true" className="text-accent" />
          ) : (
            <span
              aria-hidden="true"
              className="ds-live-dot size-2 rounded-pill bg-action-secondary"
            />
          )}
          {ended
            ? 'Question ended'
            : `Question live · ${remainingSeconds}s remaining`}
        </div>
        <Text
          variant="caption"
          tone="secondary"
          className="flex items-center justify-center gap-1 text-center"
        >
          <Timer size={14} aria-hidden="true" />
          {ended && allAsked
            ? 'Every question has been asked.'
            : ended
              ? 'Select the next question from the list when you are ready.'
              : 'Submissions close automatically at 0:00. Choose the next question after it ends.'}
        </Text>
      </Surface>
    </>
  );
}
