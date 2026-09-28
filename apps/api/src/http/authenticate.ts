import type { RequestHandler } from 'express';
import type { AuthService } from '../modules/auth/service.js';
import { authCookies } from '../modules/auth/cookies.js';

export function authenticate(
  auth: AuthService,
  production: boolean,
): RequestHandler {
  const cookies = authCookies(production, auth.config.AUTH_COOKIE_DOMAIN);
  return async (req, res, next) => {
    const user = await auth.authenticate(
      cookies.read(req).access ??
        req.get('authorization')?.replace(/^Bearer /, ''),
    );
    res.locals.userId = user.id;
    res.setHeader('Cache-Control', 'no-store');
    next();
  };
}
