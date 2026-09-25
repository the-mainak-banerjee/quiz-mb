import { parseCookie } from 'cookie';
import type { Request, Response } from 'express';
import type { AuthService } from './service.js';
export function authCookies(production: boolean, accessDomain?: string) {
  if (production && !accessDomain)
    throw new Error('AUTH_COOKIE_DOMAIN is required in production');
  const names = {
    access: (production ? '__Secure-' : '') + 'quizmb-access',
    refresh: (production ? '__Host-' : '') + 'quizmb-refresh',
  };
  const options = {
    httpOnly: true,
    secure: production,
    sameSite: 'lax' as const,
    path: '/',
  };
  const accessOptions = {
    ...options,
    ...(production && accessDomain ? { domain: accessDomain } : {}),
  };
  return {
    read(req: Request) {
      const values = parseCookie(req.headers.cookie ?? '');
      return { access: values[names.access], refresh: values[names.refresh] };
    },
    set(res: Response, credentials: Awaited<ReturnType<AuthService['login']>>) {
      res.cookie(names.access, credentials.access, {
        ...accessOptions,
        // Retain the expired JWT as a renewal hint for server-rendered pages.
        // This does NOT extend its validity: Express always verifies JWT exp.
        expires: credentials.expiresAt,
      });
      res.cookie(names.refresh, credentials.refresh, {
        ...options,
        expires: credentials.expiresAt,
      });
    },
    clear(res: Response) {
      res.clearCookie(names.access, accessOptions);
      res.clearCookie(names.refresh, options);
    },
  };
}
