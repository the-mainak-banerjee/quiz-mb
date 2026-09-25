'use client';
import { useState, type SubmitEvent } from 'react';
import Link from 'next/link';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button, FormField, Input, Text } from '@/components/ui';
import { VisuallyHidden } from '@/components/visually-hidden';
import { api } from '@/lib/api/browser';
import { apiError } from '@/lib/api/client';
import { API_ROUTES } from '@/lib/api/routes';
import { z } from 'zod';

type Field = 'name' | 'email' | 'password';
const emailSchema = z.email().max(254);

function fieldError(field: Field, value: string, signup: boolean): string {
  if (field === 'name') {
    if (!value.trim()) return 'Enter your full name.';
    return value.trim().length > 100 ? 'Use 100 characters or fewer.' : '';
  }
  if (field === 'email') {
    if (!value.trim()) return 'Enter your email address.';
    return emailSchema.safeParse(value.trim()).success
      ? ''
      : 'Enter a valid email address.';
  }
  if (signup) {
    const length = Array.from(value).length;
    return length < 15 || length > 128 ? 'Use 15–128 characters.' : '';
  }
  if (!value) return 'Enter your password.';
  return value.length > 1024 ? 'Use 1024 characters or fewer.' : '';
}

export function AuthForm({ mode }: { mode: 'login' | 'signup' }) {
  const signup = mode === 'signup';
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validateField(field: Field, value: string) {
    setErrors((previous) => ({
      ...previous,
      [field]: fieldError(field, value, signup),
    }));
  }

  function editField(field: Field, value: string) {
    setMessage('');
    // Keep untouched fields quiet; once validated, update on every edit.
    setErrors((previous) =>
      field in previous
        ? { ...previous, [field]: fieldError(field, value, signup) }
        : previous,
    );
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setMessage('');
    const data = new FormData(event.currentTarget);
    const input = {
      email: data.get('email'),
      password: data.get('password'),
      ...(signup ? { name: data.get('name') } : {}),
    };
    const fields: Field[] = signup
      ? ['name', 'email', 'password']
      : ['email', 'password'];
    const nextErrors = Object.fromEntries(
      fields.map((field) => [
        field,
        fieldError(field, String(data.get(field) ?? ''), signup),
      ]),
    );
    setErrors(nextErrors);
    const invalidField = fields.find((field) => nextErrors[field]);
    if (invalidField) {
      const control = event.currentTarget.elements.namedItem(invalidField);
      if (control instanceof HTMLElement) control.focus();
      return;
    }
    setPending(true);
    try {
      await api.post(
        signup ? API_ROUTES.AUTH.SIGNUP : API_ROUTES.AUTH.LOGIN,
        input,
      );
      // A full server navigation verifies the new session before rendering.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- Discard the anonymous router cache after changing HttpOnly cookies.
      window.location.assign('/');
    } catch (error) {
      const failure = apiError(error);
      const fieldErrors = Object.fromEntries(
        fields
          .filter((field) => failure.details[field])
          .map((field) => [field, failure.details[field]!]),
      );
      setMessage(
        Object.keys(fieldErrors).length > 0 ||
          failure.code === 'VALIDATION_ERROR'
          ? ''
          : failure.message,
      );
      setErrors((previous) => ({ ...previous, ...fieldErrors }));
      setPending(false);
    }
  }

  return (
    <form
      noValidate
      onSubmit={submit}
      className="space-y-space-md"
      aria-busy={pending}
    >
      {signup && (
        <FormField
          id="name"
          name="name"
          label="Full name"
          placeholder="Elena Rostova"
          autoComplete="name"
          required
          maxLength={100}
          error={errors.name ?? ''}
          onChange={(event) => editField('name', event.target.value)}
          onBlur={(event) => validateField('name', event.target.value)}
          disabled={pending}
        />
      )}
      <FormField
        id="email"
        name="email"
        label="Email address"
        placeholder={signup ? 'elena@company.com' : 'name@work-email.com'}
        type="email"
        autoComplete="email"
        required
        maxLength={254}
        error={errors.email ?? ''}
        onChange={(event) => editField('email', event.target.value)}
        onBlur={(event) => validateField('email', event.target.value)}
        disabled={pending}
      />
      <div className="space-y-space-xs">
        <div className="flex items-center justify-between gap-space-xs">
          <label htmlFor="password" className="text-label">
            Password <span className="text-danger">*</span>
          </label>
          {!signup && (
            <Link
              href="#"
              className="ds-focus text-caption text-accent underline-offset-4 hover:text-action-primary hover:underline"
            >
              Forgot password?
            </Link>
          )}
        </div>
        <div className="relative">
          <Input
            id="password"
            name="password"
            type={visible ? 'text' : 'password'}
            required
            autoComplete={signup ? 'new-password' : 'current-password'}
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              editField('password', event.target.value);
            }}
            onBlur={(event) => validateField('password', event.target.value)}
            disabled={pending}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={
              signup ? 'password-hint password-error' : 'password-error'
            }
            className="pr-space-2xl"
            placeholder={signup ? 'Create a secure password' : '••••••••••••'}
          />
          <Button
            type="button"
            variant="ghost"
            aria-label={visible ? 'Hide password' : 'Show password'}
            aria-pressed={visible}
            onClick={() => setVisible(!visible)}
            className="absolute right-space-xs top-1/2 -translate-y-1/2 px-space-xs text-caption"
          >
            {visible ? (
              <EyeOff aria-hidden="true" size={16} />
            ) : (
              <Eye aria-hidden="true" size={16} />
            )}
            <VisuallyHidden>
              {visible ? 'Hide password' : 'Show password'}
            </VisuallyHidden>
          </Button>
        </div>
        <Text
          id="password-error"
          role={errors.password ? 'alert' : undefined}
          variant="body-secondary"
          className="text-danger"
        >
          {errors.password}
        </Text>
      </div>
      {signup && (
        <Text id="password-hint" variant="caption" tone="secondary">
          Use 15–128 characters. Spaces and Unicode are welcome.
        </Text>
      )}
      {message && (
        <Text role="alert" variant="body-secondary" className="text-danger">
          {message}
        </Text>
      )}
      <Button type="submit" size="hero" className="w-full" disabled={pending}>
        {pending
          ? signup
            ? 'Creating account…'
            : 'Verifying…'
          : signup
            ? 'Create account'
            : 'Sign in to QuizMB'}{' '}
        <ArrowRight aria-hidden="true" size={16} />
      </Button>
      {signup && (
        <Text variant="caption" tone="secondary" className="text-center">
          By signing up, you agree to our{' '}
          <Link href="#" className="ds-focus text-accent underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="#" className="ds-focus text-accent underline">
            Privacy Policy
          </Link>
          .
        </Text>
      )}
    </form>
  );
}
