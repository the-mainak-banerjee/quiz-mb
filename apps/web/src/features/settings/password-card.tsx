'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { changePasswordSchema } from '@quizmb/contracts';
import { Button, Text } from '@/components/ui';
import { setApiErrors } from '@/components/forms/form-errors';
import { PasswordField } from '@/features/auth/password-field';
import { accountApi } from '@/lib/api/account';
import { SettingsCard } from './settings-card';

const schema = changePasswordSchema
  .extend({ confirmPassword: z.string() })
  .refine((value) => value.confirmPassword === value.newPassword, {
    path: ['confirmPassword'],
    message: 'The passwords do not match.',
  });
type Values = z.infer<typeof schema>;
const empty: Values = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

/** Current password, then the new one twice. Other devices are signed out. */
export function PasswordCard() {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting, isSubmitSuccessful, isDirty },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    mode: 'onTouched',
    defaultValues: empty,
  });
  return (
    <SettingsCard
      title="Change password"
      description="Update the password you use to sign in to QuizMB."
    >
      <form
        noValidate
        className="space-y-space-md"
        onSubmit={handleSubmit(async ({ currentPassword, newPassword }) => {
          try {
            await accountApi.changePassword({ currentPassword, newPassword });
            reset(empty);
          } catch (error) {
            setApiErrors(error, setError);
          }
        })}
      >
        <PasswordField
          id="settings-current-password"
          label="Current password"
          required
          autoComplete="current-password"
          {...register('currentPassword')}
          error={errors.currentPassword?.message}
        />
        <PasswordField
          id="settings-new-password"
          label="New password"
          required
          autoComplete="new-password"
          placeholder="Enter new password"
          hint="Use 15–128 characters."
          {...register('newPassword')}
          error={errors.newPassword?.message}
        />
        <PasswordField
          id="settings-confirm-password"
          label="Confirm new password"
          required
          autoComplete="new-password"
          placeholder="Re-enter new password"
          {...register('confirmPassword')}
          error={errors.confirmPassword?.message}
        />
        {errors.root && (
          <Text role="alert" className="text-danger">
            {errors.root.message}
          </Text>
        )}
        <div className="flex flex-wrap items-center gap-space-sm">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Changing…' : 'Change password'}
          </Button>
          {isSubmitSuccessful && !isDirty && !errors.root && (
            <Text role="status" variant="body-secondary" tone="secondary">
              Password changed. Your other devices have been signed out.
            </Text>
          )}
        </div>
      </form>
    </SettingsCard>
  );
}
