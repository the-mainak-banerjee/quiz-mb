import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createDatabase } from '@quizmb/database';
import {
  ERROR_CODE,
  HTTP_HEADER,
  LIVE_EVENTS,
  type SocketTicketDto,
} from '@quizmb/contracts';
import { createApp } from '../src/app.js';
import { MemoryMailbox } from '../src/infrastructure/email.js';
import { createLogger } from '../src/infrastructure/logger.js';
import { createRedis } from '../src/infrastructure/redis.js';
import {
  DOMAIN_EVENT,
  DomainEvents,
  type AuthSessionsRevoked,
} from '../src/infrastructure/domain-events.js';
import { LOGIN_PAUSE } from '../src/config/rate-limits.js';
import { AuthRepository } from '../src/modules/auth/repository.js';
import { AuthService } from '../src/modules/auth/service.js';
import { LoginThrottle } from '../src/modules/auth/login-throttle.js';
import { parseAuthEnv } from '../src/modules/auth/config.js';
import { UsersService } from '../src/modules/users/service.js';
import { signUpVerified } from './auth-helper.js';
import { liveSkip, startLiveHarness } from './live-harness.js';

const cookieHeader = (response: Response) =>
  response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');

// Security design 1.2: the wrong-password pause, and revocation reaching
// open sockets.
test(
  'wrong passwords pause login per address without revealing accounts',
  { skip: !process.env.DATABASE_URL || !process.env.REDIS_URL },
  async (t) => {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Development integration tests only');
    const config = parseAuthEnv(process.env);
    const db = createDatabase(
      config.DATABASE_URL,
      config.DATABASE_SSL_CA_BASE64,
    );
    const redis = createRedis(process.env.REDIS_URL!);
    await redis.connect();
    const logger = createLogger('silent');
    const events = new DomainEvents();
    const mailbox = new MemoryMailbox();
    const origin = 'http://localhost:3000';
    const server = createApp({
      allowedOrigins: [origin],
      logger,
      auth: new AuthService(
        new AuthRepository(db),
        config,
        mailbox,
        {},
        { loginThrottle: new LoginThrottle(redis, logger), events },
      ),
      users: new UsersService(db),
      database: db,
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const run = randomUUID();
    const emailOf = (who: string) => `login-${who}-${run}@example.invalid`;
    const password = 'a sufficiently long login password';
    t.after(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.user.deleteMany({
        where: { email: { endsWith: `-${run}@example.invalid` } },
      });
      await db.$disconnect();
      await redis.quit();
    });
    const request = (
      path: string,
      method = 'GET',
      body?: unknown,
      cookie = '',
    ) =>
      fetch(`${base}/api${path}`, {
        method,
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const login = (who: string, pass: string) =>
      request('/auth/login', 'POST', { email: emailOf(who), password: pass });
    const signUp = async (who: string) => {
      const response = await signUpVerified(request, mailbox, {
        name: `Login ${who}`,
        email: emailOf(who),
        password,
      });
      assert.equal(response.status, 200);
      return cookieHeader(response);
    };
    const failures = async (who: string, count: number) => {
      for (let i = 0; i < count; i++)
        assert.equal((await login(who, 'not the password')).status, 401);
    };
    const assertPaused = async (response: Response, label: string) => {
      assert.equal(response.status, 429, label);
      const body = (await response.json()) as { error: { code: string } };
      assert.equal(body.error.code, ERROR_CODE.RATE_LIMITED, label);
      const wait = Number(response.headers.get(HTTP_HEADER.RETRY_AFTER));
      assert.ok(wait > 0 && wait <= LOGIN_PAUSE.pauseSeconds, label);
      return wait;
    };

    // ---- The 5th wrong password pauses login, even with the right one.
    const victimSession = await signUp('victim');
    await failures('victim', LOGIN_PAUSE.failures);
    const wait = await assertPaused(
      await login('victim', password),
      'correct password during the pause',
    );
    // Requests during the pause do not extend it.
    await assertPaused(await login('victim', 'still wrong'), 'still paused');
    const after = await assertPaused(await login('victim', password), 'again');
    assert.ok(after <= wait, 'the pause was not extended');
    // Existing sessions keep working.
    assert.equal(
      (await request('/me', 'GET', undefined, victimSession)).status,
      200,
    );

    // ---- An unknown address behaves exactly the same (no enumeration).
    await failures('nobody', LOGIN_PAUSE.failures);
    await assertPaused(await login('nobody', password), 'unknown address');

    // ---- A successful login resets the count.
    await signUp('typo');
    await failures('typo', LOGIN_PAUSE.failures - 1);
    assert.equal((await login('typo', password)).status, 200);
    await failures('typo', LOGIN_PAUSE.failures - 1);
    assert.equal((await login('typo', password)).status, 200, 'not paused');

    // ---- Password reset keeps working and ends the pause.
    const sent = mailbox.countFor(emailOf('victim'));
    await request('/auth/password-reset', 'POST', { email: emailOf('victim') });
    const code = await mailbox.codeFor(emailOf('victim'), sent);
    const verified = (await (
      await request('/auth/password-reset/verify', 'POST', {
        email: emailOf('victim'),
        code,
      })
    ).json()) as { data: { resetToken: string } };
    const newPassword = 'a brand new long login password';
    assert.equal(
      (
        await request('/auth/password-reset/complete', 'POST', {
          resetToken: verified.data.resetToken,
          password: newPassword,
        })
      ).status,
      200,
    );
    assert.equal((await login('victim', newPassword)).status, 200);

    // ---- Logout and refresh-token replay announce the revoked family.
    const revoked: AuthSessionsRevoked[] = [];
    events.on(DOMAIN_EVENT.authSessionsRevoked, (event) => revoked.push(event));
    const leaver = await signUp('leaver');
    const leaverUser = await db.user.findUniqueOrThrow({
      where: { email: emailOf('leaver') },
      include: { sessions: true },
    });
    await request('/auth/logout', 'POST', {}, leaver);
    assert.deepEqual(revoked.at(-1), {
      familyIds: [leaverUser.sessions[0]!.familyId],
    });
    const replayer = await signUp('replayer');
    const rotated = await request('/auth/refresh', 'POST', {}, replayer);
    assert.equal(rotated.status, 200);
    // The old refresh token again: the whole family is revoked.
    assert.equal(
      (await request('/auth/refresh', 'POST', {}, replayer)).status,
      401,
    );
    const replayerUser = await db.user.findUniqueOrThrow({
      where: { email: emailOf('replayer') },
      include: { sessions: true },
    });
    assert.deepEqual(revoked.at(-1), {
      familyIds: [replayerUser.sessions[0]!.familyId],
    });
  },
);

test(
  'logout disconnects the sign-in’s open sockets and refuses new tickets',
  { skip: liveSkip },
  async (t) => {
    const harness = await startLiveHarness(t, ['host', 'player'] as const);
    const { liveSessionId } = await harness.openQuiz('Logout sockets', [
      'player',
    ]);
    const { socket } = await harness.joinAs(liveSessionId, 'player');
    const removed = harness.nextEvent<{ code: string }>(
      socket,
      LIVE_EVENTS.removed,
    );
    const disconnected = harness.nextEvent<string>(socket, 'disconnect');
    await harness.request('/auth/logout', 'POST', {}, harness.cookies.player);
    assert.equal((await removed).code, ERROR_CODE.UNAUTHENTICATED);
    assert.equal(await disconnected, 'io server disconnect');
    const ticket = await harness.request(
      `/live-sessions/${liveSessionId}/socket-ticket`,
      'POST',
      {},
      harness.cookies.player,
    );
    assert.equal(ticket.status, 401, 'no new socket ticket after logout');
    // The host's own sign-in is untouched.
    const hostTicket = await harness.data<SocketTicketDto>(
      await harness.request(
        `/live-sessions/${liveSessionId}/socket-ticket`,
        'POST',
        {},
        harness.cookies.host,
      ),
    );
    assert.ok(hostTicket.ticket);
  },
);

test(
  'a password reset disconnects every socket of that user',
  { skip: liveSkip },
  async (t) => {
    const harness = await startLiveHarness(t, ['host', 'player'] as const);
    const { liveSessionId } = await harness.openQuiz('Reset sockets', [
      'player',
    ]);
    const { socket } = await harness.joinAs(liveSessionId, 'player');
    const removed = harness.nextEvent<{ code: string }>(
      socket,
      LIVE_EVENTS.removed,
    );
    const disconnected = harness.nextEvent<string>(socket, 'disconnect');
    const email = harness.emailOf('player');
    const sent = harness.mailbox.countFor(email);
    await harness.request('/auth/password-reset', 'POST', { email });
    const code = await harness.mailbox.codeFor(email, sent);
    const { resetToken } = await harness.data<{ resetToken: string }>(
      await harness.request('/auth/password-reset/verify', 'POST', {
        email,
        code,
      }),
    );
    await harness.data(
      await harness.request('/auth/password-reset/complete', 'POST', {
        resetToken,
        password: 'a brand new long password for reset',
      }),
    );
    assert.equal((await removed).code, ERROR_CODE.UNAUTHENTICATED);
    assert.equal(await disconnected, 'io server disconnect');
    assert.equal(
      (
        await harness.request(
          `/live-sessions/${liveSessionId}/socket-ticket`,
          'POST',
          {},
          harness.cookies.player,
        )
      ).status,
      401,
      'the old sign-in can no longer get socket tickets',
    );
  },
);
