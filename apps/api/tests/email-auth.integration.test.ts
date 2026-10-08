import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createDatabase } from '@quizmb/database';
import { ERROR_CODE, OTP_RULES } from '@quizmb/contracts';
import { createApp } from '../src/app.js';
import { MemoryMailbox } from '../src/infrastructure/email.js';
import { createLogger } from '../src/infrastructure/logger.js';
import { AuthRepository } from '../src/modules/auth/repository.js';
import { AuthService } from '../src/modules/auth/service.js';
import { parseAuthEnv } from '../src/modules/auth/config.js';
import { UsersService } from '../src/modules/users/service.js';

test(
  'email verification and password reset with one-time codes',
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Development integration tests only');
    const config = parseAuthEnv(process.env);
    const db = createDatabase(
      config.DATABASE_URL,
      config.DATABASE_SSL_CA_BASE64,
    );
    const mailbox = new MemoryMailbox();
    const origin = 'http://localhost:3000';
    const server = createApp({
      allowedOrigins: [origin],
      logger: createLogger('silent'),
      auth: new AuthService(new AuthRepository(db), config, mailbox, {
        supportEmail: 'help@quizmb.test',
      }),
      users: new UsersService(db),
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const run = randomUUID();
    const emailOf = (who: string) => `otp-${who}-${run}@example.invalid`;
    const emails = ['a', 'b', 'c', 'unknown'].map(emailOf);
    t.after(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.user.deleteMany({ where: { email: { in: emails } } });
      await db.$disconnect();
    });

    const post = (path: string, body: unknown, cookie = '') =>
      fetch(`${base}/api${path}`, {
        method: 'POST',
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        body: JSON.stringify(body),
      });
    const me = (cookie: string) =>
      fetch(`${base}/api/me`, { headers: { Cookie: cookie } });
    const json = async <T>(response: Response, status: number) => {
      const body = (await response.json()) as {
        data: T;
        error?: { code: string; details?: Record<string, string> };
      };
      assert.equal(response.status, status, JSON.stringify(body));
      return body;
    };
    const cookies = (response: Response) =>
      response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
    const userId = async (email: string) =>
      (await db.user.findUniqueOrThrow({ where: { email } })).id;
    /** Ends the resend cooldown without waiting a minute. */
    const skipCooldown = async (email: string) =>
      db.verificationCode.updateMany({
        where: { userId: await userId(email) },
        data: { createdAt: new Date(Date.now() - 2 * 60_000) },
      });
    const password = 'a sufficiently long password';
    const signup = async (who: string) => {
      const body = await json<{
        status: string;
        verification: { ticket: string; email: string };
      }>(
        await post('/auth/signup', {
          name: `Person ${who}`,
          email: emailOf(who),
          password,
        }),
        201,
      );
      return body.data;
    };

    // ---- Signup: an unverified account, no session, a hashed code.
    const a = await signup('a');
    assert.equal(a.status, 'VERIFICATION_REQUIRED');
    const firstCode = await mailbox.codeFor(emailOf('a'));
    const message = mailbox.messages.at(-1)!;
    assert.match(message.subject, /verification code/);
    assert.match(message.html, /help@quizmb\.test/, 'support email included');
    const stored = await db.verificationCode.findMany({
      where: { userId: await userId(emailOf('a')) },
    });
    assert.equal(stored.length, 1);
    assert.equal(stored[0]!.codeHash.length, 64);
    assert.ok(!stored[0]!.codeHash.includes(firstCode), 'never stored plain');
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { email: emailOf('a') } }))
        .emailVerifiedAt,
      null,
    );

    // ---- Unverified login: no session, back to verification, no new code
    // inside the cooldown (the emailed code stays valid).
    const login = await json<{ status: string }>(
      await post('/auth/login', { email: emailOf('a'), password }),
      200,
    );
    assert.equal(login.data.status, 'VERIFICATION_REQUIRED');
    assert.equal(mailbox.countFor(emailOf('a')), 1, 'cooldown respected');

    // ---- Resend within the cooldown is refused.
    const early = await json(
      await post('/auth/verify-email/resend', {
        ticket: a.verification.ticket,
      }),
      429,
    );
    assert.equal(early.error?.code, ERROR_CODE.RESEND_COOLDOWN);

    // ---- A wrong code counts an attempt.
    const wrong = await json(
      await post('/auth/verify-email', {
        ticket: a.verification.ticket,
        code: firstCode === '000000' ? '111111' : '000000',
      }),
      422,
    );
    assert.equal(wrong.error?.code, ERROR_CODE.INVALID_CODE);
    assert.equal(
      wrong.error?.details?.attemptsLeft,
      String(OTP_RULES.maxAttempts - 1),
    );

    // ---- Resending replaces (deletes) the old code.
    await skipCooldown(emailOf('a'));
    await json(
      await post('/auth/verify-email/resend', {
        ticket: a.verification.ticket,
      }),
      200,
    );
    const secondCode = await mailbox.codeFor(emailOf('a'));
    assert.equal(mailbox.countFor(emailOf('a')), 2);
    assert.equal(
      await db.verificationCode.count({
        where: { userId: await userId(emailOf('a')) },
      }),
      1,
      'one code per user and purpose',
    );
    if (firstCode !== secondCode) {
      const old = await json(
        await post('/auth/verify-email', {
          ticket: a.verification.ticket,
          code: firstCode,
        }),
        422,
      );
      assert.equal(old.error?.code, ERROR_CODE.INVALID_CODE, 'old code dead');
    }

    // ---- The correct code verifies and signs in; it cannot be reused.
    const verified = await post('/auth/verify-email', {
      ticket: a.verification.ticket,
      code: secondCode,
    });
    await json(verified, 200);
    const sessionA = cookies(verified);
    assert.equal((await me(sessionA)).status, 200);
    assert.ok(
      (await db.user.findUniqueOrThrow({ where: { email: emailOf('a') } }))
        .emailVerifiedAt,
    );
    assert.equal(
      await db.verificationCode.count({
        where: { userId: await userId(emailOf('a')) },
      }),
      0,
      'a used code is deleted',
    );
    const reused = await json(
      await post('/auth/verify-email', {
        ticket: a.verification.ticket,
        code: secondCode,
      }),
      410,
    );
    assert.equal(reused.error?.code, ERROR_CODE.CODE_EXPIRED);
    const loggedIn = await json<{ status: string }>(
      await post('/auth/login', { email: emailOf('a'), password }),
      200,
    );
    assert.equal(loggedIn.data.status, 'AUTHENTICATED');

    // ---- Expired and exhausted codes are refused and deleted.
    const b = await signup('b');
    await mailbox.codeFor(emailOf('b'));
    await db.verificationCode.updateMany({
      where: { userId: await userId(emailOf('b')) },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const expired = await json(
      await post('/auth/verify-email', {
        ticket: b.verification.ticket,
        code: await mailbox.codeFor(emailOf('b')),
      }),
      410,
    );
    assert.equal(expired.error?.code, ERROR_CODE.CODE_EXPIRED);
    assert.equal(
      await db.verificationCode.count({
        where: { userId: await userId(emailOf('b')) },
      }),
      0,
    );
    await json(
      await post('/auth/verify-email/resend', {
        ticket: b.verification.ticket,
      }),
      200,
    );
    const bCode = await mailbox.codeFor(emailOf('b'));
    const notB = bCode === '000000' ? '111111' : '000000';
    for (let attempt = 1; attempt < OTP_RULES.maxAttempts; attempt++)
      await json(
        await post('/auth/verify-email', {
          ticket: b.verification.ticket,
          code: notB,
        }),
        422,
      );
    const exhausted = await json(
      await post('/auth/verify-email', {
        ticket: b.verification.ticket,
        code: notB,
      }),
      410,
    );
    assert.equal(exhausted.error?.code, ERROR_CODE.CODE_EXPIRED);
    const afterExhaustion = await json(
      await post('/auth/verify-email', {
        ticket: b.verification.ticket,
        code: bCode,
      }),
      410,
    );
    assert.equal(
      afterExhaustion.error?.code,
      ERROR_CODE.CODE_EXPIRED,
      'even the right code is dead after too many tries',
    );

    // ---- Forgot password never reveals whether an email is registered.
    const before = mailbox.countFor(emailOf('a'));
    const known = await json<{ resendAvailableAt: string }>(
      await post('/auth/password-reset', { email: emailOf('a') }),
      200,
    );
    const unknown = await json<{ resendAvailableAt: string }>(
      await post('/auth/password-reset', { email: emailOf('unknown') }),
      200,
    );
    assert.deepEqual(Object.keys(known.data), Object.keys(unknown.data));
    const resetCode = await mailbox.codeFor(emailOf('a'), before);
    assert.match(mailbox.messages.at(-1)!.subject, /password reset code/);
    await new Promise((resolve) => setTimeout(resolve, 500));
    assert.equal(mailbox.countFor(emailOf('unknown')), 0);

    // ---- Codes only work for their own purpose.
    assert.equal(
      (
        await json(
          await post('/auth/verify-email', {
            ticket: a.verification.ticket,
            code: resetCode,
          }),
          410,
        )
      ).error?.code,
      ERROR_CODE.CODE_EXPIRED,
      'a reset code cannot verify an email',
    );
    const c = await signup('c');
    const cVerification = await mailbox.codeFor(emailOf('c'));
    assert.equal(
      (
        await json(
          await post('/auth/password-reset/verify', {
            email: emailOf('c'),
            code: cVerification,
          }),
          410,
        )
      ).error?.code,
      ERROR_CODE.CODE_EXPIRED,
      'a verification code cannot reset a password',
    );

    // ---- Reset: code → token → new password; everything else signs out.
    const token = await json<{ resetToken: string; expiresAt: string }>(
      await post('/auth/password-reset/verify', {
        email: emailOf('a'),
        code: resetCode,
      }),
      200,
    );
    // The reset authorization lasts 5 minutes.
    assert.ok(
      Date.parse(token.data.expiresAt) - Date.now() <= 5 * 60_000 + 5_000,
      'reset authorization valid at most 5 minutes',
    );
    const weak = await json(
      await post('/auth/password-reset/complete', {
        resetToken: token.data.resetToken,
        password: 'too short',
      }),
      422,
    );
    assert.ok(weak.error?.details?.password, 'password policy enforced');
    const newPassword = 'a brand new sufficiently long password';
    const sentBeforeReset = mailbox.countFor(emailOf('a'));
    await json(
      await post('/auth/password-reset/complete', {
        resetToken: token.data.resetToken,
        password: newPassword,
      }),
      200,
    );
    assert.equal((await me(sessionA)).status, 401, 'signed out everywhere');
    // The owner is told, with a security email that has no code in it.
    assert.equal(mailbox.countFor(emailOf('a')), sentBeforeReset + 1);
    const changed = mailbox.messages.at(-1)!;
    assert.equal(changed.subject, 'Your QuizMB password was changed');
    assert.doesNotMatch(changed.text, /\b\d{6}\b/);
    await json(
      await post('/auth/login', { email: emailOf('a'), password }),
      401,
    );
    const fresh = await json<{ status: string }>(
      await post('/auth/login', { email: emailOf('a'), password: newPassword }),
      200,
    );
    assert.equal(fresh.data.status, 'AUTHENTICATED');
    const replay = await json(
      await post('/auth/password-reset/complete', {
        resetToken: token.data.resetToken,
        password: 'yet another sufficiently long password',
      }),
      401,
    );
    assert.equal(
      replay.error?.code,
      ERROR_CODE.AUTH_FLOW_EXPIRED,
      'a reset token works once',
    );

    // ---- Resetting an unverified account also verifies its email.
    const cBefore = mailbox.countFor(emailOf('c'));
    await post('/auth/password-reset', { email: emailOf('c') });
    const cReset = await mailbox.codeFor(emailOf('c'), cBefore);
    const cToken = await json<{ resetToken: string }>(
      await post('/auth/password-reset/verify', {
        email: emailOf('c'),
        code: cReset,
      }),
      200,
    );
    await json(
      await post('/auth/password-reset/complete', {
        resetToken: cToken.data.resetToken,
        password,
      }),
      200,
      // Same as the current password: accepted, so no answer confirms it.
    );
    assert.ok(
      (await db.user.findUniqueOrThrow({ where: { email: emailOf('c') } }))
        .emailVerifiedAt,
    );
    void c;
  },
);
