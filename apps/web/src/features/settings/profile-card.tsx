'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react';
import { profileSchema, type ProfileInput } from '@quizmb/contracts';
import { Button, FormField, Input, Text } from '@/components/ui';
import { setApiErrors } from '@/components/forms/form-errors';
import { useCurrentUser } from '@/contexts/current-user-context';
import { accountApi } from '@/lib/api/account';
import { SettingsCard } from './settings-card';

/** Name (editable) and email (read-only, verified). */
export function ProfileCard() {
  const { user, updateUser } = useCurrentUser();
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isDirty, isSubmitting, isSubmitSuccessful },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema),
    mode: 'onChange',
    defaultValues: { name: user.name },
  });
  return (
    <SettingsCard
      title="Profile"
      description="Basic account details associated with your QuizMB credentials."
    >
      <form
        noValidate
        className="space-y-space-md"
        onSubmit={handleSubmit(async (input) => {
          try {
            const saved = await accountApi.updateProfile(input);
            // The header shows the new name straight away.
            updateUser(saved);
            reset({ name: saved.name });
          } catch (error) {
            setApiErrors(error, setError);
          }
        })}
      >
        <FormField
          label="Name"
          required
          maxLength={100}
          autoComplete="name"
          // In the server HTML too, so the field is never blank before hydration.
          defaultValue={user.name}
          {...register('name')}
          {...(errors.name?.message ? { error: errors.name.message } : {})}
        />
        <div className="space-y-space-xs">
          <div className="flex items-center justify-between gap-space-xs">
            <label htmlFor="settings-email" className="text-label">
              Email
            </label>
            <Text
              as="span"
              variant="caption"
              tone="secondary"
              className="inline-flex items-center gap-1 text-success"
            >
              <Lock size={12} aria-hidden="true" />
              Verified
            </Text>
          </div>
          <div className="relative">
            <Input
              id="settings-email"
              type="email"
              value={user.email}
              readOnly
              aria-describedby="settings-email-hint"
              className="cursor-not-allowed bg-surface-low pr-space-2xl text-text-secondary"
            />
            <Lock
              size={16}
              aria-hidden="true"
              className="absolute right-control-x top-1/2 -translate-y-1/2 text-text-secondary"
            />
          </div>
          <Text id="settings-email-hint" variant="caption" tone="secondary">
            Your account email cannot be changed right now.
          </Text>
        </div>
        {errors.root && (
          <Text role="alert" className="text-danger">
            {errors.root.message}
          </Text>
        )}
        <div className="flex flex-wrap items-center gap-space-sm">
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </Button>
          {isSubmitSuccessful && !isDirty && (
            <Text role="status" variant="body-secondary" tone="secondary">
              Profile saved.
            </Text>
          )}
        </div>
      </form>
    </SettingsCard>
  );
}
