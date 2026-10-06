import type { VerificationChallengeDto } from '@quizmb/contracts';

// Multi-step auth flows keep their state in this tab's session storage, never
// in the URL: a refresh keeps the current step, a new tab starts over.
// Storage can be unavailable (private mode, blocked site data), so every
// access is guarded and the flows fall back to their first step.

const KEYS = {
  verification: 'quizmb.verification',
  reset: 'quizmb.password-reset',
} as const;

export type VerificationFlow = {
  challenge: VerificationChallengeDto;
  /** Where to continue once the email is verified. */
  returnTo: string;
};

export type ResetFlow = {
  email: string;
  resendAvailableAt: string;
  /** Present once the code was accepted. */
  resetToken?: string;
};

function read<T>(key: string): T | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The flow still works in this page; only a refresh loses the step.
  }
}

export const authFlow = {
  verification: () => read<VerificationFlow>(KEYS.verification),
  setVerification: (flow: VerificationFlow | null) =>
    write(KEYS.verification, flow),
  reset: () => read<ResetFlow>(KEYS.reset),
  setReset: (flow: ResetFlow | null) => write(KEYS.reset, flow),
};
