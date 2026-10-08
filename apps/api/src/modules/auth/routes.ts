import { Router } from 'express';
import {
  AUTH_RESULT_STATUS,
  changePasswordSchema,
  deleteAccountSchema,
  HTTP_HEADER,
  passwordResetCompleteSchema,
  passwordResetRequestSchema,
  passwordResetVerifySchema,
  resendVerificationSchema,
  verifyEmailSchema,
} from '@quizmb/contracts';
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
  // Every route here is rate limited before this router (http/rate-limit.ts).
  // Signup never signs in: the email is verified first.
  router.post('/auth/signup', async (req, res) => {
    const result = await auth.signup(validate(signupSchema, req.body));
    res.status(201).json({ success: true, data: result });
  });
  router.post('/auth/login', async (req, res) => {
    const result = await auth.login(
      validate(loginSchema, req.body),
      req.get(HTTP_HEADER.USER_AGENT),
    );
    if (result.status === AUTH_RESULT_STATUS.VERIFICATION_REQUIRED) {
      res.json({ success: true, data: result });
      return;
    }
    cookies.set(res, result.credentials);
    res.json({
      success: true,
      data: { status: result.status, user: result.credentials.user },
    });
  });
  router.post('/auth/verify-email', async (req, res) => {
    const { ticket, code } = validate(verifyEmailSchema, req.body);
    const credentials = await auth.verifyEmail(
      ticket,
      code,
      req.get(HTTP_HEADER.USER_AGENT),
    );
    cookies.set(res, credentials);
    res.json({
      success: true,
      data: {
        status: AUTH_RESULT_STATUS.AUTHENTICATED,
        user: credentials.user,
      },
    });
  });
  router.post('/auth/verify-email/resend', async (req, res) => {
    const { ticket } = validate(resendVerificationSchema, req.body);
    res.json({ success: true, data: await auth.resendVerification(ticket) });
  });
  router.post('/auth/password-reset', (req, res) => {
    const { email } = validate(passwordResetRequestSchema, req.body);
    res.json({ success: true, data: auth.requestPasswordReset(email) });
  });
  router.post('/auth/password-reset/verify', async (req, res) => {
    const { email, code } = validate(passwordResetVerifySchema, req.body);
    res.json({ success: true, data: await auth.verifyResetCode(email, code) });
  });
  router.post('/auth/password-reset/complete', async (req, res) => {
    const { resetToken, password } = validate(
      passwordResetCompleteSchema,
      req.body,
    );
    await auth.completePasswordReset(resetToken, password);
    res.json({ success: true, data: {} });
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
  // Settings. This device stays signed in; every other one is signed out.
  router.post('/me/password', async (req, res) => {
    await auth.changePassword(
      cookies.read(req).access,
      validate(changePasswordSchema, req.body),
    );
    res.json({ success: true, data: {} });
  });
  // POST with a body (the password): DELETE bodies are not reliably sent.
  router.post('/me/delete', async (req, res) => {
    const { password } = validate(deleteAccountSchema, req.body);
    const { user } = await auth.authenticateSession(cookies.read(req).access);
    await auth.confirmPassword(user, password, 'password');
    await users.deleteAccount(user.id);
    cookies.clear(res);
    res.status(204).end();
  });
  return router;
}
