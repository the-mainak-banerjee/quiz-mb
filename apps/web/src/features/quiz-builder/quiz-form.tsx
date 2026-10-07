'use client';
import { useState, useImperativeHandle, type Ref } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  quizSchema,
  type QuizInput,
  type QuizDto,
  type MediaDto,
  QUIZ_STATUS,
} from '@quizmb/contracts';
import { Button, FormField, Input, Surface, Text } from '@/components/ui';
import { Textarea } from '@/components/ui/textarea';
import { Choice } from '@/components/ui/choice';
import { CalendarClock, Clock3, Settings2, Users } from 'lucide-react';
import { Field } from '@/components/forms/field';
import { setApiErrors } from '@/components/forms/form-errors';
import { useUnsavedChanges } from '@/components/forms/unsaved-changes';
import { authoringApi, putUpload } from '@/lib/api/authoring';
import { ImageUpload } from './image-upload';
import { EDITOR_NOTICE, type EditorNotice } from './editor-notice';
import type { QuestionFormHandle } from './question-form';

export function quizValues(q?: QuizDto): QuizInput {
  return {
    title: q?.title ?? '',
    description: q?.description ?? '',
    registrationLimit: q?.registrationLimit ?? 50,
    defaultQuestionDurationSeconds: q?.defaultQuestionDurationSeconds ?? 20,
    allowLateJoin: q?.allowLateJoin ?? true,
    coverMediaId: q?.coverMediaId ?? null,
    plannedStartAt: q?.plannedStartAt ?? '',
  };
}
function localDate(value: string | null) {
  if (!value) return '';
  const d = new Date(value);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
export function QuizForm({
  projectId,
  initial,
  onSaved,
  onCancel,
  readOnly = false,
  leaving = false,
  ref,
}: {
  projectId: string;
  /** Saved and moving to the quiz's own page: keep everything disabled. */
  leaving?: boolean;
  initial?: QuizDto;
  /** Show the saved details with every control disabled. */
  readOnly?: boolean;
  /** `coverNotice`: the quiz saved but a cover chosen before saving was not added. */
  onSaved: (quiz: QuizDto, next: boolean, coverNotice?: EditorNotice) => void;
  onCancel: () => void;
  ref?: Ref<QuestionFormHandle>;
}) {
  const [cover, setCover] = useState<MediaDto | null>(initial?.cover ?? null);
  /** A cover chosen before the quiz exists; uploaded after the first save. */
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [next, setNext] = useState(false);
  const {
    register,
    control,
    handleSubmit,
    setValue,
    reset,
    setError,

    formState: { errors, isDirty, isSubmitting },
  } = useForm<QuizInput>({
    resolver: zodResolver(quizSchema),
    mode: 'onChange',
    defaultValues: quizValues(initial),
  });
  const guard = useUnsavedChanges(isDirty || uploading || !!pendingCover);
  useImperativeHandle(ref, () => ({
    confirm: guard.confirm,
    leave: guard.afterSave,
  }));
  const values = useWatch({ control });
  const title = values.title;
  const description = values.description;
  const continueWithoutSaving = !!initial && !isDirty && !uploading;
  return (
    <>
      <form
        noValidate
        onSubmit={handleSubmit(async (input) => {
          try {
            let saved: QuizDto;
            let coverNotice: EditorNotice | undefined;
            if (initial) {
              saved = await authoringApi.saveQuiz(projectId, input, initial.id);
            } else {
              // Creating also requests the cover's upload ticket; the cover
              // is uploaded, then attached (and checked) by one update.
              const { coverUpload, coverRefusal, ...created } =
                await authoringApi.createQuiz(
                  projectId,
                  input,
                  pendingCover ?? undefined,
                );
              saved = created;
              if (pendingCover && coverRefusal)
                coverNotice = EDITOR_NOTICE.COVER_REFUSED;
              else if (pendingCover) {
                try {
                  if (!coverUpload) throw new Error('No upload ticket.');
                  await putUpload(coverUpload, pendingCover);
                  saved = await authoringApi.saveQuiz(
                    projectId,
                    { ...quizValues(saved), coverMediaId: coverUpload.mediaId },
                    saved.id,
                  );
                } catch {
                  coverNotice = EDITOR_NOTICE.COVER_FAILED;
                }
              }
              setPendingCover(null);
            }
            reset(quizValues(saved));
            guard.afterSave(() => onSaved(saved, next, coverNotice));
          } catch (e) {
            setApiErrors(e, setError);
          }
        })}
        className="grid items-start gap-gutter lg:grid-cols-3"
      >
        <fieldset
          disabled={isSubmitting || leaving || readOnly}
          className="min-w-0 space-y-space-md lg:col-span-2"
        >
          <Surface className="space-y-space-md">
            <Text as="h2" variant="section-heading">
              General details
            </Text>
            <Text tone="secondary">
              {readOnly
                ? 'The essentials this quiz ran with.'
                : 'Define the essentials for your next live quiz.'}
            </Text>
            <FormField
              label="Quiz title"
              required
              maxLength={90}
              {...register('title')}
              {...(errors.title?.message
                ? { error: errors.title.message }
                : {})}
            />
            <Field
              id="quiz-description"
              label="Description & focus area"
              error={errors.description?.message}
            >
              <Textarea
                id="quiz-description"
                rows={4}
                {...register('description')}
                aria-invalid={!!errors.description}
              />
            </Field>
            <ImageUpload
              quizId={initial?.id}
              purpose="QUIZ_COVER"
              value={cover}
              readOnly={readOnly}
              {...(initial ? {} : { onDefer: setPendingCover })}
              onBusy={setUploading}
              onChange={(m) => {
                setCover(m);
                setValue('coverMediaId', m?.id ?? null, {
                  shouldDirty: true,
                  shouldValidate: true,
                });
              }}
            />
          </Surface>
          <Surface className="space-y-space-md">
            <div className="flex items-center gap-space-xs">
              <Settings2 className="text-accent" size={22} aria-hidden="true" />
              <Text as="h2" variant="section-heading">
                Session parameters
              </Text>
            </div>
            <div className="grid gap-space-md md:grid-cols-2">
              <Field
                id="registration-limit"
                label="Maximum participants"
                required
                {...(initial && initial.status !== QUIZ_STATUS.DRAFT
                  ? {
                      hint: `${initial.registrationCount} registered so far · the limit cannot go below this.`,
                    }
                  : {})}
                error={errors.registrationLimit?.message}
              >
                <div className="relative">
                  <Users
                    className="pointer-events-none absolute left-control-x top-1/2 -translate-y-1/2 text-text-secondary"
                    size={18}
                    aria-hidden="true"
                  />
                  <Input
                    id="registration-limit"
                    type="number"
                    min={1}
                    required
                    className="pl-space-xl"
                    {...register('registrationLimit', { valueAsNumber: true })}
                  />
                </div>
              </Field>
              <Field
                id="default-duration"
                label="Default duration (seconds)"
                required
                error={errors.defaultQuestionDurationSeconds?.message}
              >
                <div className="relative">
                  <Clock3
                    className="pointer-events-none absolute left-control-x top-1/2 -translate-y-1/2 text-text-secondary"
                    size={18}
                    aria-hidden="true"
                  />
                  <Input
                    id="default-duration"
                    type="number"
                    min={1}
                    required
                    className="pl-space-xl"
                    {...register('defaultQuestionDurationSeconds', {
                      valueAsNumber: true,
                    })}
                  />
                </div>
              </Field>
            </div>
            <Controller
              name="plannedStartAt"
              control={control}
              render={({ field }) => (
                <Field
                  id="quiz-date"
                  label="Planned date and time"
                  required
                  hint="Shown to participants in your local timezone. This never starts the quiz automatically."
                  error={errors.plannedStartAt?.message}
                >
                  <div className="relative">
                    <CalendarClock
                      className="pointer-events-none absolute left-control-x top-1/2 -translate-y-1/2 text-text-secondary"
                      size={18}
                      aria-hidden="true"
                    />
                    <Input
                      id="quiz-date"
                      type="datetime-local"
                      required
                      className="pl-space-xl"
                      value={localDate(field.value)}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value
                            ? new Date(e.target.value).toISOString()
                            : '',
                        )
                      }
                    />
                  </div>
                </Field>
              )}
            />
            <label className="flex items-center gap-space-xs text-body">
              <Choice type="checkbox" {...register('allowLateJoin')} />
              Allow registered participants to join after the quiz starts
            </label>
          </Surface>
          {errors.root && (
            <Text role="alert" className="text-danger">
              {errors.root.message}
            </Text>
          )}
          {!readOnly && (
            <div className="flex flex-wrap justify-between gap-space-sm">
              <Button variant="danger" onClick={() => guard.confirm(onCancel)}>
                Cancel
              </Button>
              <div className="flex flex-wrap gap-space-xs">
                <Button
                  variant="secondary"
                  type="submit"
                  disabled={uploading}
                  onClick={() => setNext(false)}
                >
                  {(isSubmitting || leaving) && !next
                    ? 'Saving…'
                    : initial && initial.status !== QUIZ_STATUS.DRAFT
                      ? 'Save changes'
                      : 'Save draft'}
                </Button>
                <Button
                  type={continueWithoutSaving ? 'button' : 'submit'}
                  disabled={uploading}
                  onClick={() => {
                    if (continueWithoutSaving) onSaved(initial, true);
                    else setNext(true);
                  }}
                >
                  {(isSubmitting || leaving) && next
                    ? 'Saving…'
                    : continueWithoutSaving
                      ? 'Continue to questions'
                      : 'Save & add questions'}
                </Button>
              </div>
            </div>
          )}
        </fieldset>
        <aside className="space-y-space-md">
          <Surface className="space-y-space-sm">
            <Text variant="caption" tone="secondary">
              {readOnly ? 'QUIZ SUMMARY' : 'DRAFT PREVIEW'}
            </Text>
            <Text as="h2" variant="card-title" className="break-words">
              {title || 'Your quiz title'}
            </Text>
            <Text tone="secondary" className="break-words">
              {description || 'Add a description to introduce your quiz.'}
            </Text>
            <Text variant="caption" tone="secondary">
              {values.registrationLimit || 0} participant seats ·{' '}
              {values.defaultQuestionDurationSeconds || 0}s default
            </Text>
          </Surface>
          {!readOnly && (
            <Surface className="space-y-space-xs bg-surface-low">
              <Text variant="label">You control the pace</Text>
              <Text variant="body-secondary" tone="secondary">
                Each question can override the default timer. Save explicitly
                before leaving; your changes are not autosaved.
              </Text>
            </Surface>
          )}
        </aside>
      </form>
      {guard.dialog}
    </>
  );
}
