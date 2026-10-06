'use client';

import { useEffect, useState, type SubmitEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Circle,
  Clock3,
  EyeOff,
  Info,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import {
  ERROR_CODE,
  OTP_RULES,
  PASSWORD_LIMITS,
  passwordResetRequestSchema,
} from '@quizmb/contracts';
import { Button, Callout, FormField, Text } from '@/components/ui';
import { APP_LINKS } from '@/config/navigation';
import { authApi } from '@/lib/api/auth';
import { apiError } from '@/lib/api/client';
import { authFlow, type ResetFlow } from '@/lib/auth/auth-flow';
import { cn } from '@/lib/utils';
import { AuthCard } from './auth-card';
import { codeProblem } from './auth-messages';
import { CodeLimits } from './code-limits';
import { OtpInput } from './otp-input';
import { PasswordField } from './password-field';
import { useSecondsUntil } from './resend-timer';
import { useResetFlow } from './use-auth-flow';

const EYEBROW = 'Account recovery';
const linkClass =
  'ds-focus inline-flex items-center gap-1 text-caption text-accent underline-offset-4 hover:text-action-primary hover:underline';
const primaryLinkClass =
  'ds-focus ds-control-motion ds-primary-motion inline-flex h-control-large w-full items-center justify-center gap-space-xs rounded-control bg-action-primary px-control-x text-label text-action-on-primary hover:bg-action-primary-hover';

const panel = {
  eyebrow: 'How recovery works',
  title: 'Reset your password with a one-time code',
  points: [
    {
      icon: <EyeOff size={18} />,
      title: 'Private by design',
      detail:
        'We never say whether an email has an account, so nobody can probe for one.',
    },
    {
      icon: <Clock3 size={18} />,
      title: `Codes last ${OTP_RULES.ttlSeconds / 60} minutes`,
      detail: `Each code works once. After ${OTP_RULES.maxAttempts} wrong tries, request a new one.`,
    },
    {
      icon: <LogOut size={18} />,
      title: 'Signed out everywhere',
      detail: 'A new password signs out every device that used the old one.',
    },
  ],
};

const backToSignIn = (
  <Link href={APP_LINKS.AUTH.LOGIN} className={linkClass}>
    <ArrowLeft size={14} aria-hidden="true" />
    Back to sign in
  </Link>
);

/** Shown when a later step is opened without the earlier ones in this tab. */
function StartOver({ title }: { title: string }) {
  return (
    <AuthCard
      eyebrow={EYEBROW}
      title={title}
      description="Password recovery continues only in the tab where it started. Request a new reset code to continue."
      panel={panel}
      footer={backToSignIn}
    >
      <Link href={APP_LINKS.AUTH.FORGOT_PASSWORD} className={primaryLinkClass}>
        Request a reset code
        <ArrowRight aria-hidden="true" size={16} />
      </Link>
    </AuthCard>
  );
}

// ---- 1. Forgot password ----------------------------------------------------

export function ForgotPasswordView() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  async function send(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const parsed = passwordResetRequestSchema.safeParse({ email });
    if (!parsed.success) {
      setError(
        email.trim()
          ? 'Enter a valid email address.'
          : 'Enter your email address.',
      );
      return;
    }
    setPending(true);
    setError('');
    setMessage('');
    try {
      const sent = await authApi.requestPasswordReset(parsed.data.email);
      authFlow.setReset({
        email: parsed.data.email,
        resendAvailableAt: sent.resendAvailableAt,
      });
      router.push(APP_LINKS.AUTH.RESET_CODE);
    } catch (cause) {
      setMessage(apiError(cause).message);
      setPending(false);
    }
  }

  return (
    <AuthCard
      eyebrow={EYEBROW}
      title="Forgot your password?"
      description="Enter your email address and we'll send a 6-digit code to reset your password."
      panel={panel}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <Text as="span" variant="caption" tone="secondary">
            Remember your password?
          </Text>
          {backToSignIn}
        </div>
      }
    >
      <form noValidate onSubmit={send} className="flex flex-col gap-space-md">
        <FormField
          id="email"
          name="email"
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="name@work-email.com"
          required
          maxLength={254}
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            setError('');
          }}
          disabled={pending}
          error={error}
        />
        <Callout icon={<Info size={16} aria-hidden="true" />}>
          If an account exists for this email, we&apos;ll send a 6-digit reset
          code. Check your inbox and spam folder. You can ask for up to{' '}
          {OTP_RULES.resetRequestsPerHour} codes per hour.
        </Callout>
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
          {pending ? 'Sending…' : 'Send reset code'}
        </Button>
      </form>
    </AuthCard>
  );
}

// ---- 2. Enter the reset code -----------------------------------------------

export function ResetCode() {
  const flow = useResetFlow();
  if (flow === undefined) return null;
  return <ResetCodeView flow={flow} />;
}

export function ResetCodeView({
  flow,
  initialError = '',
}: {
  flow: ResetFlow | null;
  initialError?: string;
}) {
  const router = useRouter();
  const [resendAt, setResendAt] = useState(flow?.resendAvailableAt ?? null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<'verify' | 'resend' | null>(null);
  const resendIn = useSecondsUntil(resendAt);

  if (!flow) return <StartOver title="Request a new reset code" />;
  const email = flow.email;

  async function verify(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    if (code.length !== OTP_RULES.length) {
      setError('Enter the 6-digit code.');
      return;
    }
    setPending('verify');
    setError('');
    setNotice('');
    try {
      const { resetToken } = await authApi.verifyResetCode(email, code);
      authFlow.setReset({
        email,
        resendAvailableAt: resendAt ?? new Date().toISOString(),
        resetToken,
      });
      router.push(APP_LINKS.AUTH.NEW_PASSWORD);
      return;
    } catch (cause) {
      const failure = apiError(cause);
      setError(codeProblem(failure));
      if (failure.code === ERROR_CODE.CODE_EXPIRED) setCode('');
    }
    setPending(null);
  }

  async function resend() {
    if (pending || resendIn > 0) return;
    setPending('resend');
    setError('');
    setNotice('');
    try {
      const sent = await authApi.requestPasswordReset(email);
      setResendAt(sent.resendAvailableAt);
      authFlow.setReset({ email, resendAvailableAt: sent.resendAvailableAt });
      setCode('');
      setNotice(
        'If an account exists for this email, a new code is on its way.',
      );
    } catch (cause) {
      setError(apiError(cause).message);
    }
    setPending(null);
  }

  return (
    <AuthCard
      eyebrow={EYEBROW}
      title="Check your email"
      description={
        <>
          {/* Never confirm that the email has an account. */}
          If an account exists for{' '}
          <strong className="font-semibold text-text-primary">{email}</strong>,
          we&apos;ve sent a 6-digit code to it. Enter the code below to reset
          your password.
        </>
      }
      panel={panel}
      footer={backToSignIn}
    >
      <form noValidate onSubmit={verify} className="flex flex-col gap-space-md">
        <div className="space-y-space-xs">
          <Text as="span" variant="label">
            Reset code
          </Text>
          <OtpInput
            label="Reset code"
            value={code}
            onChange={(next) => {
              setCode(next);
              setError('');
            }}
            invalid={Boolean(error)}
            disabled={pending !== null}
            describedBy={error ? 'reset-code-error' : undefined}
          />
        </div>
        {error && (
          <Callout
            id="reset-code-error"
            role="alert"
            icon={<AlertCircle size={16} aria-hidden="true" />}
            className="bg-danger-surface text-danger-on-surface [&>span]:text-danger"
          >
            {error}
          </Callout>
        )}
        {notice && (
          <Text role="status" variant="caption" className="text-accent">
            {notice}
          </Text>
        )}
        <div className="flex flex-wrap items-center justify-between gap-space-xs">
          <Button
            type="button"
            variant="ghost"
            className="px-space-xs tabular-nums"
            icon={<RefreshCw size={16} aria-hidden="true" />}
            disabled={pending !== null || resendIn > 0}
            onClick={() => void resend()}
          >
            {pending === 'resend'
              ? 'Sending…'
              : resendIn > 0
                ? `Resend code in ${resendIn}s`
                : 'Resend code'}
          </Button>
          <Link
            href={APP_LINKS.AUTH.FORGOT_PASSWORD}
            onClick={() => authFlow.setReset(null)}
            className={linkClass}
          >
            <Mail size={14} aria-hidden="true" />
            Use a different email
          </Link>
        </div>
        <Button
          type="submit"
          size="hero"
          className="w-full"
          icon={<ArrowRight aria-hidden="true" size={16} />}
          iconPosition="right"
          disabled={pending !== null}
        >
          {pending === 'verify' ? 'Checking…' : 'Verify code'}
        </Button>
        <CodeLimits reset />
      </form>
    </AuthCard>
  );
}

// ---- 3. Create a new password ----------------------------------------------

const passwordLength = (value: string) => Array.from(value).length;

function Rule({ met, children }: { met: boolean; children: string }) {
  return (
    <li
      className={cn(
        'flex items-center gap-space-xs text-caption',
        met ? 'text-accent' : 'text-text-secondary',
      )}
    >
      {met ? (
        <Check size={14} aria-hidden="true" />
      ) : (
        <Circle size={14} aria-hidden="true" />
      )}
      {children}
      <span className="sr-only">{met ? '(done)' : '(not yet)'}</span>
    </li>
  );
}

export function NewPassword() {
  const flow = useResetFlow();
  if (flow === undefined) return null;
  return <NewPasswordView flow={flow} />;
}

export function NewPasswordView({ flow }: { flow: ResetFlow | null }) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{
    password?: string | undefined;
    confirm?: string | undefined;
  }>({});
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [expired, setExpired] = useState(false);

  if (!flow?.resetToken || expired)
    return <StartOver title="Your reset session has ended" />;
  const resetToken = flow.resetToken;

  const length = passwordLength(password);
  const longEnough =
    length >= PASSWORD_LIMITS.min && length <= PASSWORD_LIMITS.max;
  const matches = password.length > 0 && password === confirm;

  async function save(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const next = {
      ...(longEnough
        ? {}
        : {
            password: `Use ${PASSWORD_LIMITS.min}–${PASSWORD_LIMITS.max} characters.`,
          }),
      ...(matches ? {} : { confirm: 'The passwords do not match.' }),
    };
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    setMessage('');
    try {
      await authApi.completePasswordReset(resetToken, password);
      authFlow.setReset(null);
      router.replace(APP_LINKS.AUTH.RESET_DONE);
      return;
    } catch (cause) {
      const failure = apiError(cause);
      if (
        failure.code === ERROR_CODE.AUTH_FLOW_EXPIRED ||
        failure.code === ERROR_CODE.CODE_EXPIRED
      ) {
        authFlow.setReset(null);
        setExpired(true);
      } else if (failure.details.password)
        setErrors({ password: failure.details.password });
      else setMessage(failure.message);
    }
    setPending(false);
  }

  return (
    <AuthCard
      eyebrow={EYEBROW}
      title="Create a new password"
      description="Choose a strong password for your QuizMB account."
      panel={panel}
      footer={backToSignIn}
    >
      <form noValidate onSubmit={save} className="flex flex-col gap-space-md">
        <PasswordField
          id="new-password"
          name="password"
          label="New password"
          required
          autoComplete="new-password"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setErrors((current) => ({ ...current, password: undefined }));
          }}
          disabled={pending}
          error={errors.password}
        />
        <ul
          aria-label="Password requirements"
          className="-mt-space-sm space-y-1"
        >
          <Rule met={longEnough}>
            {`${PASSWORD_LIMITS.min}–${PASSWORD_LIMITS.max} characters (spaces and any characters are fine)`}
          </Rule>
        </ul>
        <PasswordField
          id="confirm-password"
          name="confirm"
          label="Confirm new password"
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => {
            setConfirm(event.target.value);
            setErrors((current) => ({ ...current, confirm: undefined }));
          }}
          disabled={pending}
          error={errors.confirm}
        />
        <ul aria-label="Confirmation" className="-mt-space-sm space-y-1">
          <Rule met={matches}>Passwords match</Rule>
        </ul>
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
          {pending ? 'Saving…' : 'Reset password'}
        </Button>
      </form>
    </AuthCard>
  );
}

// ---- 4. Done -----------------------------------------------------------------

const REDIRECT_SECONDS = 15;

export function ResetDoneView({
  autoRedirect = true,
}: {
  autoRedirect?: boolean;
}) {
  const router = useRouter();
  const [redirectAt] = useState(() =>
    new Date(Date.now() + REDIRECT_SECONDS * 1000).toISOString(),
  );
  const seconds = useSecondsUntil(redirectAt);
  useEffect(() => {
    if (autoRedirect && seconds === 0) router.replace(APP_LINKS.AUTH.LOGIN);
  }, [autoRedirect, seconds, router]);

  return (
    <AuthCard
      eyebrow={EYEBROW}
      title="Password reset"
      description="Your password has been updated. Sign in with your new password."
      panel={panel}
    >
      <div className="flex flex-col gap-space-md">
        <Callout icon={<ShieldCheck size={16} aria-hidden="true" />}>
          <strong className="font-semibold text-text-primary">
            Signed out everywhere.
          </strong>{' '}
          Every device that was signed in with your old password has been signed
          out.
        </Callout>
        <Link href={APP_LINKS.AUTH.LOGIN} className={primaryLinkClass}>
          Back to sign in
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
        {autoRedirect && (
          <Text
            role="status"
            variant="caption"
            tone="secondary"
            className="tabular-nums"
          >
            Taking you to sign in in {seconds}s.
          </Text>
        )}
      </div>
    </AuthCard>
  );
}
