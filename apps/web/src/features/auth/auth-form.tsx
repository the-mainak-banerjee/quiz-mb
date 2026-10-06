'use client';
import { useState, type SubmitEvent } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button, FormField, Text } from '@/components/ui';
import { APP_LINKS } from '@/config/navigation';
import { api } from '@/lib/api/browser';
import { apiError } from '@/lib/api/client';
import { API_ROUTES } from '@/lib/api/routes';
import { z } from 'zod';
import {
  AUTH_RESULT_STATUS,
  ERROR_CODE,
  PASSWORD_LIMITS,
  type AuthResultDto,
} from '@quizmb/contracts';
import { useRouter } from 'next/navigation';
import { authFlow } from '@/lib/auth/auth-flow';
import { PasswordField } from './password-field';

type Field = 'name' | 'email' | 'password' | 'confirm';
const emailSchema = z.email().max(254);

function fieldError(
  field: Field,
  value: string,
  signup: boolean,
  password = '',
): string {
  if (field === 'confirm') {
    if (!value) return 'Confirm your password.';
    return value === password ? '' : 'The passwords do not match.';
  }
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
    return length < PASSWORD_LIMITS.min || length > PASSWORD_LIMITS.max
      ? `Use ${PASSWORD_LIMITS.min}–${PASSWORD_LIMITS.max} characters.`
      : '';
  }
  if (!value) return 'Enter your password.';
  return value.length > 1024 ? 'Use 1024 characters or fewer.' : '';
}

export function AuthForm({
  mode,
  returnTo,
}: {
  mode: 'login' | 'signup';
  returnTo: string;
}) {
  const signup = mode === 'signup';
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [confirm, setConfirm] = useState('');

  function validateField(field: Field, value: string) {
    setErrors((previous) => ({
      ...previous,
      [field]: fieldError(field, value, signup, password),
    }));
  }

  function editField(field: Field, value: string) {
    setMessage('');
    // Keep untouched fields quiet; once validated, update on every edit.
    setErrors((previous) => {
      const next =
        field in previous
          ? { ...previous, [field]: fieldError(field, value, signup, password) }
          : previous;
      // A changed password re-checks an already checked confirmation.
      return field === 'password' && 'confirm' in next
        ? { ...next, confirm: fieldError('confirm', confirm, signup, value) }
        : next;
    });
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
      ? ['name', 'email', 'password', 'confirm']
      : ['email', 'password'];
    const nextErrors = Object.fromEntries(
      fields.map((field) => [
        field,
        fieldError(
          field,
          String(data.get(field) ?? ''),
          signup,
          String(data.get('password') ?? ''),
        ),
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
      const result = await api.post<AuthResultDto>(
        signup ? API_ROUTES.AUTH.SIGNUP : API_ROUTES.AUTH.LOGIN,
        input,
      );
      if (result.status === AUTH_RESULT_STATUS.VERIFICATION_REQUIRED) {
        // No session yet: the email must be verified first.
        authFlow.setVerification({
          challenge: result.verification,
          returnTo,
        });
        router.push(APP_LINKS.AUTH.VERIFY_EMAIL);
        return;
      }
      // A full server navigation verifies the new session before rendering.
      window.location.assign(returnTo);
    } catch (error) {
      const failure = apiError(error);
      const fieldErrors = Object.fromEntries(
        fields
          .filter((field) => failure.details[field])
          .map((field) => [field, failure.details[field]!]),
      );
      setMessage(
        Object.keys(fieldErrors).length > 0 ||
          failure.code === ERROR_CODE.VALIDATION_ERROR
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
      <PasswordField
        id="password"
        name="password"
        label="Password"
        required
        autoComplete={signup ? 'new-password' : 'current-password'}
        value={password}
        onChange={(event) => {
          setPassword(event.target.value);
          editField('password', event.target.value);
        }}
        onBlur={(event) => validateField('password', event.target.value)}
        disabled={pending}
        placeholder={signup ? 'Create a secure password' : '••••••••••••'}
        error={errors.password}
        {...(signup
          ? {
              hint: `Use ${PASSWORD_LIMITS.min}–${PASSWORD_LIMITS.max} characters. Spaces and Unicode are welcome.`,
            }
          : {
              labelAction: (
                <Link
                  href={APP_LINKS.AUTH.FORGOT_PASSWORD}
                  className="ds-focus text-caption text-accent underline-offset-4 hover:text-action-primary hover:underline"
                >
                  Forgot password?
                </Link>
              ),
            })}
      />
      {signup && (
        // Checked in the browser only; the API receives one password.
        <PasswordField
          id="confirm"
          name="confirm"
          label="Confirm password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => {
            setConfirm(event.target.value);
            editField('confirm', event.target.value);
          }}
          onBlur={(event) => validateField('confirm', event.target.value)}
          disabled={pending}
          placeholder="Re-enter your password"
          error={errors.confirm}
        />
      )}
      {message && (
        <Text role="alert" variant="body-secondary" className="text-danger">
          {message}
        </Text>
      )}
      <Button
        type="submit"
        size="hero"
        className="w-full"
        icon={<ArrowRight aria-hidden="true" size={16} />}
        iconPosition="right"
        disabled={pending}
      >
        {pending
          ? signup
            ? 'Creating account…'
            : 'Verifying…'
          : signup
            ? 'Create account'
            : 'Sign in to QuizMB'}
      </Button>
      {signup && (
        <Text variant="caption" tone="secondary" className="text-center">
          By signing up, you agree to our{' '}
          <Link
            href={APP_LINKS.LEGAL.TERMS}
            className="ds-focus text-accent underline"
          >
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link
            href={APP_LINKS.LEGAL.PRIVACY}
            className="ds-focus text-accent underline"
          >
            Privacy Policy
          </Link>
          .
        </Text>
      )}
    </form>
  );
}
