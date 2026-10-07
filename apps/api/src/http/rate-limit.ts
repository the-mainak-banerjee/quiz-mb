import { Router, type Request, type Response } from 'express';
import { ERROR_CODE, HTTP_HEADER } from '@quizmb/contracts';
import type { RateLimits, RateRule } from '../config/rate-limits.js';
import type { RateLimiter } from '../infrastructure/rate-limiter.js';
import { ApiError } from './api-error.js';

type Identify = (req: Request, res: Response) => string | undefined;

/** Who a rule counts: the client IP, the signed-in user or the account. */
const BY = {
  // `req.ip` honours the configured number of trusted proxy hops.
  ip: (req) => req.ip,
  user: (_req, res) => res.locals.userId as string | undefined,
  // Normalized like the auth validation, so case or spaces do not reset it.
  email: (req) => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    return typeof email === 'string' ? email.trim().toLowerCase() : undefined;
  },
} satisfies Record<string, Identify>;

function limit(limiter: RateLimiter, ...checks: [RateRule, Identify][]) {
  return async (req: Request, res: Response, next: () => void) => {
    for (const [rule, identify] of checks) {
      const identifier = identify(req, res);
      if (!identifier) continue;
      const wait = await limiter.hit(rule, identifier);
      if (wait) {
        res.setHeader(HTTP_HEADER.RETRY_AFTER, String(wait));
        throw new ApiError(
          429,
          ERROR_CODE.RATE_LIMITED,
          'Too many requests. Please wait a moment and try again.',
        );
      }
    }
    next();
  };
}

/** Sign-in endpoints, before authentication (by IP and account). */
export function authRateLimits(limiter: RateLimiter, rules: RateLimits) {
  const router = Router();
  // Wrong passwords per account are paused by the auth service.
  router.post('/auth/login', limit(limiter, [rules.loginIp, BY.ip]));
  router.post('/auth/signup', limit(limiter, [rules.signupIp, BY.ip]));
  router.post('/auth/refresh', limit(limiter, [rules.refreshIp, BY.ip]));
  router.post('/auth/verify-email', limit(limiter, [rules.codeCheckIp, BY.ip]));
  router.post(
    '/auth/verify-email/resend',
    limit(limiter, [rules.resendIp, BY.ip]),
  );
  router.post(
    '/auth/password-reset',
    limit(
      limiter,
      [rules.passwordResetIp, BY.ip],
      [rules.passwordResetAccount, BY.email],
    ),
  );
  router.post(
    '/auth/password-reset/verify',
    limit(limiter, [rules.codeCheckIp, BY.ip]),
  );
  router.post(
    '/auth/password-reset/complete',
    limit(limiter, [rules.passwordResetCompleteIp, BY.ip]),
  );
  return router;
}

/** Signed-in endpoints, after authentication (by user). */
export function userRateLimits(limiter: RateLimiter, rules: RateLimits) {
  const router = Router();
  const byUser = (rule: RateRule) => limit(limiter, [rule, BY.user]);
  router.post('/projects', byUser(rules.createProject));
  router.post('/projects/:id/quizzes', byUser(rules.createQuiz));
  router.post('/quizzes/:id/register', byUser(rules.register));
  router.post('/media/upload-request', byUser(rules.uploadRequest));
  router.post('/quizzes/:id/live-session', byUser(rules.openLobby));
  router.post('/quizzes/:id/watch-ticket', byUser(rules.socketTicket));
  router.post('/live-sessions/:id/socket-ticket', byUser(rules.socketTicket));
  return router;
}
