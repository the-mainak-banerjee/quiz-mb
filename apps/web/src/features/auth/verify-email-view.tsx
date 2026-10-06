'use client';

import { useState, type SubmitEvent } from 'react';
import Link from 'next/link';
import {
  AlertCircle,
  ArrowRight,
  Clock3,
  KeyRound,
  MailCheck,
  RefreshCw,
  Repeat,
} from 'lucide-react';
import {
  AUTH_RESULT_STATUS,
  ERROR_CODE,
  OTP_RULES,
  type VerificationChallengeDto,
} from '@quizmb/contracts';
import { Button, Callout, Text } from '@/components/ui';
import { APP_LINKS } from '@/config/navigation';
import { authApi } from '@/lib/api/auth';
import { apiError } from '@/lib/api/client';
import { authFlow, type VerificationFlow } from '@/lib/auth/auth-flow';
import { cn } from '@/lib/utils';
import { AuthCard } from './auth-card';
import { codeProblem } from './auth-messages';
import { CodeLimits, cooldownEnd } from './code-limits';
import { OtpInput } from './otp-input';
import { useSecondsUntil } from './resend-timer';
import { useVerificationFlow } from './use-auth-flow';

const panel = {
  eyebrow: 'Why we verify',
  title: 'One quick step before you start',
  points: [
    {
      icon: <MailCheck size={18} />,
      title: 'Your email, confirmed',
      detail:
        'Results, rankings and history stay tied to a real person you can reach.',
    },
    {
      icon: <Clock3 size={18} />,
      title: `Codes last ${OTP_RULES.ttlSeconds / 60} minutes`,
      detail: `After ${OTP_RULES.maxAttempts} wrong tries, request a new one.`,
    },
    {
      icon: <Repeat size={18} />,
      title: 'One code at a time',
      detail: 'Requesting a new code replaces the previous one.',
    },
  ],
};

const minutesAndSeconds = (total: number) =>
  `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;

/** The verify-email step, from this tab's stored verification flow. */
export function VerifyEmail() {
  const flow = useVerificationFlow();
  if (flow === undefined) return null;
  return <VerifyEmailView flow={flow} />;
}

/**
 * Enter the emailed code. `initialError` lets previews show the refused
 * state; real errors come from the API.
 */
export function VerifyEmailView({
  flow,
  initialError = '',
}: {
  flow: VerificationFlow | null;
  initialError?: string;
}) {
  const [challenge, setChallenge] = useState<VerificationChallengeDto | null>(
    flow?.challenge ?? null,
  );
  const [code, setCode] = useState('');
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<'verify' | 'resend' | null>(null);
  const [ended, setEnded] = useState(false);
  const resendIn = useSecondsUntil(challenge?.resendAvailableAt);
  const expiresIn = useSecondsUntil(challenge?.expiresAt);

  if (!flow || !challenge || ended)
    return (
      <AuthCard
        eyebrow="Email verification"
        title="Verification session ended"
        description="For your security, verification only continues in the tab where it started. Sign in again and we'll send you a new code."
        panel={panel}
      >
        <Link
          href={APP_LINKS.AUTH.LOGIN}
          className="ds-focus ds-control-motion ds-primary-motion inline-flex h-control-large w-full items-center justify-center gap-space-xs rounded-control bg-action-primary px-control-x text-label text-action-on-primary hover:bg-action-primary-hover"
        >
          Sign in again
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </AuthCard>
    );

  const current = challenge;
  const returnTo = flow.returnTo;

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
      const result = await authApi.verifyEmail(current.ticket, code);
      if (result.status === AUTH_RESULT_STATUS.AUTHENTICATED) {
        authFlow.setVerification(null);
        // A full server navigation verifies the new session before rendering.
        window.location.assign(returnTo);
        return;
      }
    } catch (cause) {
      const failure = apiError(cause);
      if (failure.code === ERROR_CODE.AUTH_FLOW_EXPIRED) {
        authFlow.setVerification(null);
        setEnded(true);
      } else {
        setError(codeProblem(failure));
        if (failure.code === ERROR_CODE.CODE_EXPIRED) setCode('');
      }
    }
    setPending(null);
  }

  async function resend() {
    if (pending || resendIn > 0) return;
    setPending('resend');
    setError('');
    setNotice('');
    try {
      const next = await authApi.resendVerification(current.ticket);
      setChallenge(next);
      authFlow.setVerification({ challenge: next, returnTo });
      setCode('');
      setNotice(`We sent a new code to ${next.email}.`);
    } catch (cause) {
      const failure = apiError(cause);
      if (failure.code === ERROR_CODE.AUTH_FLOW_EXPIRED) {
        authFlow.setVerification(null);
        setEnded(true);
      } else {
        const until =
          failure.code === ERROR_CODE.RESEND_COOLDOWN
            ? cooldownEnd(failure.details)
            : null;
        if (until) setChallenge({ ...current, resendAvailableAt: until });
        setError(failure.message);
      }
    }
    setPending(null);
  }

  return (
    <AuthCard
      eyebrow="Email verification"
      title="Verify your email"
      description={
        <>
          We sent a 6-digit code to{' '}
          <strong className="font-semibold text-text-primary">
            {current.email}
          </strong>
          . Enter it below to activate your account.
        </>
      }
      panel={panel}
      footer={
        <Text variant="caption" tone="secondary">
          Didn&apos;t get it? Check your spam folder, or resend the code when
          the timer ends.
        </Text>
      }
    >
      <form noValidate onSubmit={verify} className="flex flex-col gap-space-md">
        <div className="space-y-space-xs">
          <div className="flex flex-wrap items-center justify-between gap-space-xs">
            <Text as="span" variant="label" id="verification-code-label">
              Verification code
            </Text>
            <Text
              as="span"
              variant="caption"
              tone="secondary"
              className={cn(
                'inline-flex items-center gap-1 tabular-nums',
                expiresIn === 0 && 'text-danger',
              )}
            >
              <Clock3 size={14} aria-hidden="true" />
              {expiresIn > 0
                ? `Expires in ${minutesAndSeconds(expiresIn)}`
                : 'Code expired'}
            </Text>
          </div>
          <OtpInput
            label="Verification code"
            value={code}
            onChange={(next) => {
              setCode(next);
              setError('');
            }}
            invalid={Boolean(error)}
            disabled={pending !== null}
            describedBy={error ? 'verification-code-error' : undefined}
          />
        </div>
        {error && (
          <Callout
            id="verification-code-error"
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
            href={APP_LINKS.AUTH.SIGNUP}
            onClick={() => authFlow.setVerification(null)}
            className="ds-focus inline-flex items-center gap-1 text-caption text-accent underline-offset-4 hover:text-action-primary hover:underline"
          >
            <KeyRound size={14} aria-hidden="true" />
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
          {pending === 'verify' ? 'Verifying…' : 'Verify email'}
        </Button>
        <CodeLimits />
      </form>
    </AuthCard>
  );
}
