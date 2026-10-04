import { Router } from 'express';
import { HTTP_HEADER } from '@quizmb/contracts';
import { BEARER_PREFIX, CACHE_NO_STORE } from '../../config/constants.js';
import type { AuthService } from './service.js';
import type { UsersService } from '../users/service.js';
import { authCookies } from './cookies.js';
import {
  loginSchema,
  signupSchema,
  profileSchema,
  validate,
} from './validation.js';
import { csrf } from '../../http/csrf.js';
import { ApiError } from '../../http/api-error.js';
export function authRoutes(
  auth: AuthService,
  users: UsersService,
  production: boolean,
  origins: readonly string[],
) {
  const router = Router();
  const cookies = authCookies(production, auth.config.AUTH_COOKIE_DOMAIN);
  router.use((_req, res, next) => {
    res.setHeader(HTTP_HEADER.CACHE_CONTROL, CACHE_NO_STORE);
    next();
  });
  router.use(csrf(origins));
  // Signup, login and refresh are rate limited before this router
  // (http/rate-limit.ts).
  router.post('/auth/signup', async (req, res) => {
    const credentials = await auth.signup(
      validate(signupSchema, req.body),
      req.get(HTTP_HEADER.USER_AGENT),
    );
    cookies.set(res, credentials);
    res.status(201).json({ success: true, data: { user: credentials.user } });
  });
  router.post('/auth/login', async (req, res) => {
    const credentials = await auth.login(
      validate(loginSchema, req.body),
      req.get(HTTP_HEADER.USER_AGENT),
    );
    cookies.set(res, credentials);
    res.json({ success: true, data: { user: credentials.user } });
  });
  router.post('/auth/refresh', async (req, res) => {
    try {
      const credentials = await auth.refresh(cookies.read(req).refresh);
      cookies.set(res, credentials);
      res.json({ success: true, data: { user: credentials.user } });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) cookies.clear(res);
      throw error;
    }
  });
  router.post('/auth/logout', async (req, res) => {
    await auth.logout(cookies.read(req).refresh);
    cookies.clear(res);
    res.json({ success: true, data: {} });
  });
  router.get('/me', async (req, res) => {
    const user = await auth.authenticate(
      cookies.read(req).access ??
        req.get(HTTP_HEADER.AUTHORIZATION)?.replace(BEARER_PREFIX, ''),
    );
    res.json({ success: true, data: { ...user, avatarUrl: null } });
  });
  router.patch('/me', async (req, res) => {
    const user = await auth.authenticate(
      cookies.read(req).access ??
        req.get(HTTP_HEADER.AUTHORIZATION)?.replace(BEARER_PREFIX, ''),
    );
    const { name } = validate(profileSchema, req.body);
    res.json({ success: true, data: await users.updateName(user.id, name) });
  });
  return router;
}
