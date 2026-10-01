import type { ReactNode } from 'react';
import { Check } from 'lucide-react';
import { Choice } from '@/components/ui/choice';
import { Text } from '@/components/ui';
import { cn } from '@/lib/utils';
import { QUESTION_TYPE } from '@quizmb/contracts';

type ChoiceType =
  typeof QUESTION_TYPE.SINGLE_CHOICE | typeof QUESTION_TYPE.MULTIPLE_CHOICE;

export function QuizOption({
  type,
  index,
  isCorrect,
  onCorrectChange,
  children,
  action,
}: {
  type: ChoiceType;
  index: number;
  isCorrect: boolean;
  onCorrectChange?: (checked: boolean) => void;
  children: ReactNode;
  action?: ReactNode;
}) {
  const letter = String.fromCharCode(65 + index);
  const indicator = (
    <>
      <Choice
        type={type === QUESTION_TYPE.SINGLE_CHOICE ? 'radio' : 'checkbox'}
        name={onCorrectChange ? 'correct-answer' : undefined}
        aria-label={`Option ${letter} is correct`}
        checked={isCorrect}
        readOnly={!onCorrectChange}
        tabIndex={onCorrectChange ? undefined : -1}
        onChange={
          onCorrectChange
            ? (event) => onCorrectChange(event.target.checked)
            : undefined
        }
      />
      <Text
        as="span"
        variant="label"
        className={cn(
          'flex size-control shrink-0 items-center justify-center rounded-control border border-border-control bg-surface',
          isCorrect && 'border-accent bg-action-primary text-text-inverse',
        )}
      >
        {letter}
      </Text>
    </>
  );

  return (
    <div
      className={cn(
        'ds-control-motion flex items-center gap-space-sm rounded-control border p-space-sm',
        isCorrect
          ? 'border-accent bg-action-secondary shadow-card'
          : 'border-border-surface bg-surface-low',
        onCorrectChange && !isCorrect && 'hover:border-border-control',
      )}
    >
      {onCorrectChange ? (
        <label className="flex min-h-control cursor-pointer items-center gap-space-xs">
          {indicator}
        </label>
      ) : (
        <div className="flex min-h-control items-center gap-space-xs">
          {indicator}
        </div>
      )}
      <div className="min-w-0 flex-1">{children}</div>
      {isCorrect && (
        <Text
          as="span"
          variant="caption"
          className="hidden items-center gap-space-xs rounded-pill bg-surface px-badge-x py-badge-y text-accent sm:inline-flex"
        >
          <Check size={14} aria-hidden="true" /> Correct answer
        </Text>
      )}
      {action}
    </div>
  );
}
