import type { RequestHandler } from 'express';
import { HTTP_HEADER } from '@quizmb/contracts';
import { BEARER_PREFIX, CACHE_NO_STORE } from '../config/constants.js';
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
        req.get(HTTP_HEADER.AUTHORIZATION)?.replace(BEARER_PREFIX, ''),
    );
    res.locals.userId = user.id;
    res.setHeader(HTTP_HEADER.CACHE_CONTROL, CACHE_NO_STORE);
    next();
  };
}
