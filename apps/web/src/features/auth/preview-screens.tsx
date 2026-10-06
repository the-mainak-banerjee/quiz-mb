'use client';

import { useSyncExternalStore } from 'react';
import { OTP_RULES } from '@quizmb/contracts';
import {
  ForgotPasswordView,
  NewPasswordView,
  ResetCodeView,
  ResetDoneView,
} from './password-reset';
import { VerifyEmailView } from './verify-email-view';
import type { AuthPreviewSlug } from './preview-list';

const noSubscription = () => () => {};

const inSeconds = (seconds: number) =>
  new Date(Date.now() + seconds * 1000).toISOString();

/** Auth screens with fixture state; the API is only called on submit. */
export function AuthPreviewScreen({ screen }: { screen: AuthPreviewSlug }) {
  // Fixture times are relative to now: render in the browser only, so the
  // server and browser markup never disagree about a countdown.
  const inBrowser = useSyncExternalStore(
    noSubscription,
    () => true,
    () => false,
  );
  if (!inBrowser) return null;
  const verification = {
    challenge: {
      ticket: 'preview-ticket',
      email: 'm***ak@example.com',
      expiresAt: inSeconds(OTP_RULES.ttlSeconds - 20),
      resendAvailableAt: inSeconds(40),
    },
    returnTo: '/dashboard',
  };
  const reset = { email: 'maya@example.com', resendAvailableAt: inSeconds(52) };
  switch (screen) {
    case 'verify-email':
      return <VerifyEmailView flow={verification} />;
    case 'verify-email-invalid':
      return (
        <VerifyEmailView
          flow={{
            ...verification,
            challenge: {
              ...verification.challenge,
              expiresAt: inSeconds(-1),
              resendAvailableAt: inSeconds(-1),
            },
          }}
          initialError="This code has expired or can no longer be used. Request a new code."
        />
      );
    case 'verify-email-ended':
      return <VerifyEmailView flow={null} />;
    case 'forgot-password':
      return <ForgotPasswordView />;
    case 'reset-code':
      return <ResetCodeView flow={reset} />;
    case 'reset-code-invalid':
      return (
        <ResetCodeView
          flow={reset}
          initialError="That code is incorrect. You have 3 tries left."
        />
      );
    case 'new-password':
      return <NewPasswordView flow={{ ...reset, resetToken: 'preview' }} />;
    case 'reset-done':
      return <ResetDoneView autoRedirect={false} />;
  }
}
