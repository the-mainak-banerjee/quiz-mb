// REST rate limits, counted in Redis so they hold across API instances.
// Per-IP limits stay generous because a classroom or office shares one IP;
// per-account and per-user limits do the real work. Socket command limits
// live with the live sessions (live-sessions/constants.ts).

export type RateRule = {
  /** Part of the Redis key: rate:{scope}:{identifier}:{window}. */
  scope: string;
  limit: number;
  windowSeconds: number;
};

export const RATE_LIMITS = {
  loginIp: { scope: 'login-ip', limit: 100, windowSeconds: 15 * 60 },
  loginAccount: { scope: 'login-account', limit: 10, windowSeconds: 15 * 60 },
  signupIp: { scope: 'signup-ip', limit: 20, windowSeconds: 60 * 60 },
  refreshIp: { scope: 'refresh-ip', limit: 600, windowSeconds: 15 * 60 },
  register: { scope: 'register', limit: 20, windowSeconds: 60 },
  uploadRequest: { scope: 'upload-request', limit: 30, windowSeconds: 10 * 60 },
  openLobby: { scope: 'open-lobby', limit: 10, windowSeconds: 60 },
  /** Live and watch socket tickets share one budget per user. */
  socketTicket: { scope: 'socket-ticket', limit: 30, windowSeconds: 60 },
} as const satisfies Record<string, RateRule>;

export type RateLimits = Record<keyof typeof RATE_LIMITS, RateRule>;
