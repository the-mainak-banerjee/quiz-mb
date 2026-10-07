// REST rate limits, counted in Redis so they hold across API instances.
// Per-IP limits stay generous because a classroom or office shares one IP;
// per-account and per-user limits do the real work. Socket command limits
// live with the live sessions (live-sessions/constants.ts).

import { OTP_RULES } from '@quizmb/contracts';

export type RateRule = {
  /** Part of the Redis key: rate:{scope}:{identifier}:{window}. */
  scope: string;
  limit: number;
  windowSeconds: number;
};

export const RATE_LIMITS = {
  /** Wrong passwords are limited per account by LOGIN_PAUSE instead. */
  loginIp: { scope: 'login-ip', limit: 100, windowSeconds: 60 },
  signupIp: { scope: 'signup-ip', limit: 20, windowSeconds: 60 * 60 },
  refreshIp: { scope: 'refresh-ip', limit: 600, windowSeconds: 15 * 60 },
  /** Entering emailed codes: verify email and verify reset code. */
  codeCheckIp: {
    scope: 'code-check-ip',
    limit: OTP_RULES.checksPerWindow,
    windowSeconds: OTP_RULES.checkWindowSeconds,
  },
  resendIp: { scope: 'resend-ip', limit: 10, windowSeconds: 60 * 60 },
  passwordResetIp: { scope: 'reset-ip', limit: 10, windowSeconds: 60 * 60 },
  passwordResetAccount: {
    scope: 'reset-account',
    limit: OTP_RULES.resetRequestsPerHour,
    windowSeconds: 60 * 60,
  },
  passwordResetCompleteIp: {
    scope: 'reset-complete-ip',
    limit: 10,
    windowSeconds: 60 * 60,
  },
  register: { scope: 'register', limit: 20, windowSeconds: 60 },
  uploadRequest: { scope: 'upload-request', limit: 30, windowSeconds: 10 * 60 },
  openLobby: { scope: 'open-lobby', limit: 10, windowSeconds: 60 },
  /** Live and watch socket tickets share one budget per user. */
  socketTicket: { scope: 'socket-ticket', limit: 30, windowSeconds: 60 },
} as const satisfies Record<string, RateRule>;

export type RateLimits = Record<keyof typeof RATE_LIMITS, RateRule>;

/**
 * Wrong passwords per email address (whether or not it has an account, so
 * the pause never reveals one): this many in a rolling window pause password
 * login for that address. Requests during the pause are refused without
 * checking the password and do not extend it; a successful login or password
 * reset clears the count. Existing sessions and password reset keep working.
 */
export const LOGIN_PAUSE = {
  failures: 5,
  windowSeconds: 15 * 60,
  pauseSeconds: 15 * 60,
} as const;
