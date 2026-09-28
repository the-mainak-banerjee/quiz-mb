'use client';
import { useImperativeHandle, type Ref } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  projectSchema,
  type ProjectDto,
  type ProjectInput,
} from '@quizmb/contracts';
import { Button, FormField, Text } from '@/components/ui';
import { Textarea } from '@/components/ui/textarea';
import { Field } from '@/components/forms/field';
import { useUnsavedChanges } from '@/components/forms/unsaved-changes';
import { setApiErrors } from '@/components/forms/form-errors';
import { authoringApi } from '@/lib/api/authoring';

export function ProjectForm({
  initial,
  onSaved,
  onCancel,
  cancelVariant = 'danger',
  ref,
}: {
  initial?: ProjectDto;
  onSaved: (project: ProjectDto) => void;
  onCancel: () => void;
  cancelVariant?: 'secondary' | 'danger';
  ref?: Ref<{ close: () => void }>;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting },
  } = useForm<ProjectInput>({
    resolver: zodResolver(projectSchema),
    mode: 'onChange',
    defaultValues: {
      name: initial?.name ?? '',
      description: initial?.description ?? '',
    },
  });
  const guard = useUnsavedChanges(isDirty);
  useImperativeHandle(ref, () => ({ close: () => guard.confirm(onCancel) }));
  return (
    <>
      <form
        noValidate
        onSubmit={handleSubmit(async (input) => {
          try {
            const project = await authoringApi.saveProject(input, initial?.id);
            reset(input);
            guard.afterSave(() => onSaved(project));
          } catch (error) {
            setApiErrors(error, setError);
          }
        })}
        className="space-y-space-md"
      >
        <FormField
          label="Project name"
          required
          maxLength={60}
          {...register('name')}
          {...(errors.name?.message ? { error: errors.name.message } : {})}
        />
        <Field
          id="project-description"
          label="Description (optional)"
          error={errors.description?.message}
        >
          <Textarea
            id="project-description"
            rows={4}
            maxLength={240}
            aria-invalid={!!errors.description}
            aria-describedby={
              errors.description ? 'project-description-error' : undefined
            }
            {...register('description')}
          />
        </Field>
        {errors.root && (
          <Text role="alert" className="text-danger">
            {errors.root.message}
          </Text>
        )}
        <div className="flex flex-wrap justify-end gap-space-xs">
          <Button
            variant={cancelVariant}
            disabled={isSubmitting}
            onClick={() => guard.confirm(onCancel)}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Saving…'
              : initial
                ? 'Save project'
                : 'Create & continue'}
          </Button>
        </div>
      </form>
      {guard.dialog}
    </>
  );
}
