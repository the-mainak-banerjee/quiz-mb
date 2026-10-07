import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createDatabase } from '@quizmb/database';
import { ERROR_CODE, HTTP_HEADER, OTP_RULES } from '@quizmb/contracts';
import { createApp } from '../src/app.js';
import { MemoryMailbox } from '../src/infrastructure/email.js';
import { createLogger } from '../src/infrastructure/logger.js';
import { AuthRepository } from '../src/modules/auth/repository.js';
import { AuthService } from '../src/modules/auth/service.js';
import { parseAuthEnv } from '../src/modules/auth/config.js';
import { hashPassword } from '../src/modules/auth/password.js';
import {
  cleanUpAuth,
  EMAIL_EVENT_RETENTION_MS,
  UNVERIFIED_ACCOUNT_RETENTION_MS,
} from '../src/modules/auth/cleanup.js';
import { UsersService } from '../src/modules/users/service.js';

// Security design 1.1: per-address send limits, failures across resends,
// signup without account enumeration, single-use codes under concurrency
// and the cleanup of never-verified accounts.
test(
  'account creation and email verification limits',
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Development integration tests only');
    const config = parseAuthEnv(process.env);
    const db = createDatabase(
      config.DATABASE_URL,
      config.DATABASE_SSL_CA_BASE64,
    );
    const repository = new AuthRepository(db);
    const mailbox = new MemoryMailbox();
    const origin = 'http://localhost:3000';
    const server = createApp({
      allowedOrigins: [origin],
      logger: createLogger('silent'),
      auth: new AuthService(repository, config, mailbox),
      users: new UsersService(db),
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const run = randomUUID();
    const emailOf = (who: string) => `verify-${who}-${run}@example.invalid`;
    t.after(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.user.deleteMany({
        where: { email: { endsWith: `-${run}@example.invalid` } },
      });
      await db.$disconnect();
    });

    const post = (path: string, body: unknown) =>
      fetch(`${base}/api${path}`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    type Body<T> = {
      data: T;
      error?: {
        code: string;
        message: string;
        details?: Record<string, string>;
      };
    };
    const json = async <T>(response: Response, status: number) => {
      const body = (await response.json()) as Body<T>;
      assert.equal(response.status, status, JSON.stringify(body));
      return body;
    };
    type Challenge = {
      status: string;
      verification: {
        ticket: string;
        email: string;
        expiresAt: string;
        resendAvailableAt: string;
      };
    };
    const password = 'a sufficiently long password';
    const signup = async (
      who: string,
      pass = password,
      name = `Person ${who}`,
    ) =>
      (
        await json<Challenge>(
          await post('/auth/signup', {
            name,
            email: emailOf(who),
            password: pass,
          }),
          201,
        )
      ).data;
    const user = (who: string) =>
      db.user.findUniqueOrThrow({ where: { email: emailOf(who) } });
    /** Ends the resend cooldown without waiting a minute. */
    const skipCooldown = async (who: string) =>
      db.verificationCode.updateMany({
        where: { userId: (await user(who)).id },
        data: { createdAt: new Date(Date.now() - 2 * 60_000) },
      });
    const resend = (ticket: string) =>
      post('/auth/verify-email/resend', { ticket });
    const wrongCode = (code: string) =>
      code === '000000' ? '000001' : '000000';

    // ---- Signup never reveals whether the address has an account.
    const fresh = await signup('owner');
    const ownerCode = await mailbox.codeFor(emailOf('owner'));
    await json(
      await post('/auth/verify-email', {
        ticket: fresh.verification.ticket,
        code: ownerCode,
      }),
      200,
    );
    const sentBefore = mailbox.countFor(emailOf('owner'));
    const repeat = await signup('owner', 'another long password', 'Intruder');
    assert.deepEqual(Object.keys(repeat).sort(), Object.keys(fresh).sort());
    assert.deepEqual(
      Object.keys(repeat.verification).sort(),
      Object.keys(fresh.verification).sort(),
    );
    assert.equal(repeat.status, fresh.status);
    assert.equal(repeat.verification.email, fresh.verification.email);
    assert.equal(mailbox.countFor(emailOf('owner')), sentBefore + 1);
    const notice = mailbox.messages.at(-1)!;
    assert.equal(notice.subject, 'You already have a QuizMB account');
    assert.doesNotMatch(notice.text, /\b\d{6}\b/, 'a notice has no code');
    const owner = await user('owner');
    assert.equal(owner.name, 'Person owner', 'name never changes');
    // The step behaves like a real one: a wrong code counts down attempts…
    const wrong = await json(
      await post('/auth/verify-email', {
        ticket: repeat.verification.ticket,
        code: '123456',
      }),
      422,
    );
    assert.equal(wrong.error?.code, ERROR_CODE.INVALID_CODE);
    // …a resend answers the same, but nothing is emailed…
    await skipCooldown('owner');
    await json<Challenge['verification']>(
      await resend(repeat.verification.ticket),
      200,
    );
    assert.equal(mailbox.countFor(emailOf('owner')), sentBefore + 1);
    // …and even a correct code could never sign in to the verified account.
    assert.equal(
      await repository.verifyAndSignIn(owner.id, {
        id: randomUUID(),
        familyId: randomUUID(),
        refreshTokenHash: randomUUID().replace(/-/g, '').padEnd(64, '0'),
        expiresAt: new Date(Date.now() + 60_000),
        userAgent: null,
      }),
      null,
    );

    // ---- An existing unverified account gets a fresh code; its password
    // is never overwritten by the second signup.
    await signup('pending');
    await mailbox.codeFor(emailOf('pending'));
    await skipCooldown('pending');
    const pendingBefore = mailbox.countFor(emailOf('pending'));
    await signup('pending', 'an attackers long password', 'Attacker');
    await mailbox.codeFor(emailOf('pending'), pendingBefore);
    const pending = await user('pending');
    assert.equal(pending.name, 'Person pending');
    assert.equal(
      (
        await post('/auth/login', {
          email: emailOf('pending'),
          password: 'an attackers long password',
        })
      ).status,
      401,
      'the second password was not stored',
    );

    // ---- Simultaneous submissions of a correct code verify once.
    const twin = await signup('twin');
    const twinCode = await mailbox.codeFor(emailOf('twin'));
    const both = await Promise.all(
      [0, 1].map(() =>
        post('/auth/verify-email', {
          ticket: twin.verification.ticket,
          code: twinCode,
        }),
      ),
    );
    assert.deepEqual(
      both.map((response) => response.status).sort(),
      [200, 410],
    );
    assert.equal(
      await db.authSession.count({
        where: { userId: (await user('twin')).id },
      }),
      1,
    );

    // ---- Per-address send limit: 5 codes per hour, including the first.
    const capped = await signup('capped');
    for (let send = 2; send <= OTP_RULES.sendsPerHour; send++) {
      await skipCooldown('capped');
      await json(await resend(capped.verification.ticket), 200);
    }
    assert.equal(mailbox.countFor(emailOf('capped')), OTP_RULES.sendsPerHour);
    await skipCooldown('capped');
    const hourLimit = await json(await resend(capped.verification.ticket), 429);
    assert.equal(hourLimit.error?.code, ERROR_CODE.RESEND_COOLDOWN);
    assert.match(hourLimit.error!.message, /several codes/);
    assert.ok(Number(hourLimit.error?.details?.retryAfterSeconds) > 60);
    assert.equal(mailbox.countFor(emailOf('capped')), OTP_RULES.sendsPerHour);

    // ---- …and 10 per rolling 24 hours: older sends still count.
    const daily = await signup('daily');
    const dailyUser = await user('daily');
    await db.authEmailEvent.createMany({
      data: Array.from({ length: OTP_RULES.sendsPerDay - 1 }, (_, i) => ({
        userId: dailyUser.id,
        purpose: 'EMAIL_VERIFICATION' as const,
        kind: 'SENT' as const,
        createdAt: new Date(Date.now() - (2 + i) * 60 * 60 * 1000),
      })),
    });
    await skipCooldown('daily');
    const dayLimit = await json(await resend(daily.verification.ticket), 429);
    assert.equal(dayLimit.error?.code, ERROR_CODE.RESEND_COOLDOWN);

    // ---- Wrong codes are limited across resends: a new code never restores
    // failed attempts.
    const guesser = await signup('guesser');
    let guessCode = await mailbox.codeFor(emailOf('guesser'));
    /** Requests a new code (skipping the cooldown) and reads it. */
    const newGuessCode = async () => {
      await skipCooldown('guesser');
      const sent = mailbox.countFor(emailOf('guesser'));
      await json(await resend(guesser.verification.ticket), 200);
      guessCode = await mailbox.codeFor(emailOf('guesser'), sent);
    };
    const guessWrong = async (times: number) => {
      for (let i = 0; i < times; i++)
        await json(
          await post('/auth/verify-email', {
            ticket: guesser.verification.ticket,
            code: wrongCode(guessCode),
          }),
          422,
        );
    };
    // 4 + 4 + 2 wrong codes over three codes: 10 failures in the window,
    // although no single code reached its 5 attempts.
    await guessWrong(4);
    await newGuessCode();
    await guessWrong(4);
    await newGuessCode();
    await guessWrong(OTP_RULES.failuresPerWindow - 8);
    await newGuessCode();
    // Even the correct, fresh code is refused until failures age out.
    const locked = await post('/auth/verify-email', {
      ticket: guesser.verification.ticket,
      code: guessCode,
    });
    const lockedBody = await json(locked, 429);
    assert.equal(lockedBody.error?.code, ERROR_CODE.RATE_LIMITED);
    assert.ok(Number(locked.headers.get(HTTP_HEADER.RETRY_AFTER)) > 0);
    // Once the failures are older than the window, the code works again.
    await db.authEmailEvent.updateMany({
      where: { userId: (await user('guesser')).id, kind: 'CODE_FAILED' },
      data: {
        createdAt: new Date(
          Date.now() - (OTP_RULES.failureWindowSeconds + 60) * 1000,
        ),
      },
    });
    await json(
      await post('/auth/verify-email', {
        ticket: guesser.verification.ticket,
        code: guessCode,
      }),
      200,
    );

    // ---- An unverified account has no session, so nothing authenticated.
    const loginPending = await json<{ status: string }>(
      await post('/auth/login', { email: emailOf('pending'), password }),
      200,
    );
    assert.equal(loginPending.data.status, 'VERIFICATION_REQUIRED');
    assert.equal(
      (await fetch(`${base}/api/projects`, { headers: { Origin: origin } }))
        .status,
      401,
    );

    // ---- Cleanup: never-verified accounts older than 7 days go; verified
    // and newer ones stay; old email events are dropped.
    const now = Date.now();
    const old = new Date(now - UNVERIFIED_ACCOUNT_RETENTION_MS - 60_000);
    const passwordHash = await hashPassword(password);
    const stale = await db.user.create({
      data: {
        name: 'Stale',
        email: emailOf('stale'),
        passwordHash,
        createdAt: old,
      },
    });
    const oldVerified = await db.user.create({
      data: {
        name: 'Old verified',
        email: emailOf('old-verified'),
        passwordHash,
        createdAt: old,
        emailVerifiedAt: old,
      },
    });
    const recent = await db.user.create({
      data: {
        name: 'Recent',
        email: emailOf('recent'),
        passwordHash,
        createdAt: new Date(
          now - UNVERIFIED_ACCOUNT_RETENTION_MS + 60 * 60_000,
        ),
      },
    });
    const oldEvent = await db.authEmailEvent.create({
      data: {
        userId: recent.id,
        purpose: 'EMAIL_VERIFICATION',
        kind: 'SENT',
        createdAt: new Date(now - EMAIL_EVENT_RETENTION_MS - 60_000),
      },
    });
    const removed = await cleanUpAuth(repository, now);
    assert.ok(removed.accounts >= 1);
    assert.equal(await db.user.findUnique({ where: { id: stale.id } }), null);
    assert.ok(await db.user.findUnique({ where: { id: oldVerified.id } }));
    assert.ok(await db.user.findUnique({ where: { id: recent.id } }));
    assert.equal(
      await db.authEmailEvent.findUnique({ where: { id: oldEvent.id } }),
      null,
    );
  },
);
