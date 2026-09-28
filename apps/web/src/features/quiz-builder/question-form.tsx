'use client';
import { useState, useImperativeHandle, type Ref } from 'react';
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  questionSchema,
  AUTHORING_LIMITS,
  type QuestionInput,
  type QuestionDto,
  type QuizDto,
  type MediaDto,
} from '@quizmb/contracts';
import { ArrowRight, FileText, Info, Plus, Save, Trash2 } from 'lucide-react';
import { Button, FormField, Input, Surface, Text } from '@/components/ui';
import { Select } from '@/components/ui/select';
import { VisuallyHidden } from '@/components/visually-hidden';
import { setApiErrors } from '@/components/forms/form-errors';
import { useUnsavedChanges } from '@/components/forms/unsaved-changes';
import { authoringApi } from '@/lib/api/authoring';
import { MarkdownEditor } from './markdown-editor';
import { ImageUpload } from './image-upload';
import { QuizOption } from './quiz-option';

export const QUESTION_LABELS = {
  SINGLE_CHOICE: 'Single-choice',
  MULTIPLE_CHOICE: 'Multiple-answer',
  DESCRIPTIVE: 'Descriptive',
};
export function questionValues(q?: QuestionDto): QuestionInput {
  return {
    type: q?.type ?? 'SINGLE_CHOICE',
    text: q?.text ?? '',
    imageMediaId: q?.imageMediaId ?? null,
    durationOverrideSeconds: q?.durationOverrideSeconds ?? null,
    options: q?.options.map((o) => ({ ...o })) ?? [
      { text: '', isCorrect: false },
      { text: '', isCorrect: false },
    ],
  };
}
export type QuestionFormHandle = { confirm: (action: () => void) => void };
export function QuestionForm({
  quiz,
  initial,
  questionNumber,
  questionCount,
  onSaved,
  onReview,
  ref,
}: {
  quiz: QuizDto;
  initial?: QuestionDto;
  questionNumber: number;
  questionCount: number;
  onSaved: (quiz: QuizDto, addNext: boolean) => void;
  onReview: () => void;
  ref?: Ref<QuestionFormHandle>;
}) {
  const {
    control,
    register,
    handleSubmit,
    setValue,
    setError,
    reset,

    formState: { errors, isDirty, isSubmitting },
  } = useForm<QuestionInput>({
    resolver: zodResolver(questionSchema),
    mode: 'onChange',
    defaultValues: questionValues(initial),
  });
  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: 'options',
  });
  const type = useWatch({ control, name: 'type' });
  const options = useWatch({ control, name: 'options' });
  const [image, setImage] = useState<MediaDto | null>(initial?.image ?? null);
  const [uploading, setUploading] = useState(false);
  const [submittingAction, setSubmittingAction] = useState<'save' | 'next'>(
    'save',
  );
  const correctCount = options.filter((option) => option.isCorrect).length;
  const guard = useUnsavedChanges(isDirty || uploading || initial?.id === '');
  useImperativeHandle(ref, () => ({
    confirm: (action) =>
      guard.confirm(() => {
        reset(questionValues(initial));
        setImage(initial?.image ?? null);
        action();
      }),
  }));
  const submitQuestion = (addNext: boolean) =>
    handleSubmit(async (input) => {
      try {
        const saved = await authoringApi.saveQuestion(
          quiz.id,
          input,
          initial?.id,
        );
        reset(input);
        onSaved(saved, addNext);
      } catch (error) {
        setApiErrors(error, setError);
      }
    });
  return (
    <>
      <form noValidate onSubmit={submitQuestion(false)}>
        <fieldset disabled={isSubmitting} className="min-w-0 space-y-space-md">
          <Surface className="space-y-space-md">
            <div className="flex flex-wrap items-start justify-between gap-space-sm border-b border-border-surface pb-space-md">
              <div className="space-y-space-xs">
                <Text variant="caption" className="text-accent">
                  QUESTION {questionNumber} OF {Math.max(questionCount, 1)}
                </Text>
                <Text as="h2" variant="section-heading">
                  Build your question
                </Text>
              </div>
              <Text
                variant="caption"
                tone="secondary"
                className="rounded-pill bg-surface-low px-badge-x py-badge-y"
              >
                {QUESTION_LABELS[type]}
              </Text>
            </div>
            <div className="grid gap-space-md md:grid-cols-2">
              <div className="space-y-space-xs">
                <label htmlFor="question-type" className="text-label">
                  Question type
                </label>
                <Select
                  id="question-type"
                  value={type}
                  onChange={(e) => {
                    const next = e.target.value as QuestionInput['type'];
                    setValue('type', next, {
                      shouldDirty: true,
                      shouldValidate: true,
                    });
                    if (next === 'DESCRIPTIVE') replace([]);
                    else if (!fields.length)
                      replace([
                        { text: '', isCorrect: false },
                        { text: '', isCorrect: false },
                      ]);
                    else if (next === 'SINGLE_CHOICE') {
                      let chosen = false;
                      replace(
                        options.map((o) => {
                          const isCorrect = o.isCorrect && !chosen;
                          if (isCorrect) chosen = true;
                          return { ...o, isCorrect };
                        }),
                      );
                    }
                  }}
                >
                  {Object.entries(QUESTION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </div>
              <FormField
                label={`Timer override (default ${quiz.defaultQuestionDurationSeconds}s)`}
                type="number"
                min={1}
                {...register('durationOverrideSeconds', {
                  setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
                })}
                {...(errors.durationOverrideSeconds?.message
                  ? { error: errors.durationOverrideSeconds.message }
                  : {})}
              />
            </div>
            <Controller
              name="text"
              control={control}
              render={({ field }) => (
                <MarkdownEditor
                  value={field.value}
                  onChange={field.onChange}
                  error={errors.text?.message}
                />
              )}
            />
            <ImageUpload
              quizId={quiz.id}
              purpose="QUESTION_IMAGE"
              value={image}
              onBusy={setUploading}
              onChange={(m) => {
                setImage(m);
                setValue('imageMediaId', m?.id ?? null, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
            <div className="flex flex-wrap items-start justify-between gap-space-sm border-t border-border-surface pt-space-lg">
              <div className="space-y-space-xs">
                <Text as="h2" variant="section-heading">
                  {type === 'DESCRIPTIVE'
                    ? 'Participant response preview'
                    : 'Answer options'}
                </Text>
                <Text variant="body-secondary" tone="secondary">
                  {type === 'DESCRIPTIVE'
                    ? 'Participants will enter a written response. Descriptive questions are ungraded and award no points.'
                    : 'Use the selection control to mark each correct response.'}
                </Text>
              </div>
              {type !== 'DESCRIPTIVE' && (
                <Text
                  variant="caption"
                  className="rounded-pill bg-action-secondary px-badge-x py-badge-y text-accent"
                >
                  {type === 'SINGLE_CHOICE'
                    ? 'Single correct choice'
                    : `${correctCount} correct ${correctCount === 1 ? 'answer' : 'answers'} specified`}
                </Text>
              )}
            </div>
            {type === 'MULTIPLE_CHOICE' && (
              <div className="flex gap-space-sm rounded-control border border-border-surface bg-surface-low p-space-sm">
                <Info className="mt-space-xs shrink-0 text-accent" size={18} />
                <Text variant="body-secondary" tone="secondary">
                  Strict multi-selection grading applies. Participants must
                  select every correct answer and no distractors.
                </Text>
              </div>
            )}
            {type === 'DESCRIPTIVE' ? (
              <div className="flex min-h-40 flex-col items-center justify-center gap-space-sm rounded-control border border-dashed border-border-control bg-surface-low p-space-lg text-center">
                <FileText className="text-accent" size={28} />
                <Text variant="label">Written response area</Text>
                <Text variant="body-secondary" tone="secondary">
                  Learners will compose a free-form response here.
                </Text>
              </div>
            ) : (
              <>
                {fields.map((field, index) => (
                  <QuizOption
                    key={field.id}
                    type={type}
                    index={index}
                    isCorrect={options[index]?.isCorrect ?? false}
                    onCorrectChange={(checked) => {
                      if (type === 'SINGLE_CHOICE')
                        options.forEach((_, optionIndex) =>
                          setValue(
                            `options.${optionIndex}.isCorrect`,
                            optionIndex === index,
                            {
                              shouldDirty: true,
                              shouldValidate: true,
                            },
                          ),
                        );
                      else
                        setValue(`options.${index}.isCorrect`, checked, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                    }}
                    action={
                      <Button
                        variant="ghost"
                        className="px-space-xs"
                        icon={<Trash2 size={18} />}
                        disabled={fields.length <= 2}
                        onClick={() => remove(index)}
                      >
                        <VisuallyHidden>
                          Remove option {index + 1}
                        </VisuallyHidden>
                      </Button>
                    }
                  >
                    <div className="space-y-space-xs">
                      <Input
                        aria-label={`Option ${String.fromCharCode(65 + index)}`}
                        placeholder={`Option ${String.fromCharCode(65 + index)}`}
                        className="border-transparent bg-surface shadow-none"
                        {...register(`options.${index}.text`)}
                        aria-invalid={!!errors.options?.[index]?.text}
                      />
                      {errors.options?.[index]?.text?.message && (
                        <Text
                          role="alert"
                          variant="caption"
                          className="text-danger"
                        >
                          {errors.options[index]!.text!.message!}
                        </Text>
                      )}
                    </div>
                  </QuizOption>
                ))}
                <Button
                  variant="secondary"
                  icon={<Plus size={18} />}
                  disabled={fields.length >= AUTHORING_LIMITS.options}
                  onClick={() => append({ text: '', isCorrect: false })}
                >
                  Add option
                </Button>
                {(errors.options?.message || errors.options?.root?.message) && (
                  <Text role="alert" className="text-danger">
                    {errors.options.message || errors.options.root?.message}
                  </Text>
                )}
              </>
            )}
            {errors.root && (
              <Text role="alert" className="text-danger">
                {errors.root.message}
              </Text>
            )}
            <div className="flex flex-col gap-space-sm border-t border-border-surface pt-space-md md:flex-row md:items-center md:justify-between">
              <div className="flex flex-wrap gap-space-xs">
                <Button
                  variant="secondary"
                  type="submit"
                  icon={<Save size={18} />}
                  disabled={uploading}
                  onClick={() => setSubmittingAction('save')}
                >
                  {isSubmitting && submittingAction === 'save'
                    ? 'Saving…'
                    : 'Save question'}
                </Button>
                <Button
                  type="button"
                  icon={<Plus size={18} />}
                  disabled={uploading}
                  onClick={async () => {
                    setSubmittingAction('next');
                    await submitQuestion(true)();
                  }}
                >
                  {isSubmitting && submittingAction === 'next'
                    ? 'Saving…'
                    : 'Add next question'}
                </Button>
              </div>
              <Button
                variant="ghost"
                icon={<ArrowRight size={18} />}
                iconPosition="right"
                disabled={isSubmitting || uploading}
                onClick={() => guard.confirm(onReview)}
              >
                Move to review & publish
              </Button>
            </div>
          </Surface>
        </fieldset>
      </form>
      {guard.dialog}
    </>
  );
}
