import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createDatabase } from '@quizmb/database';
import {
  ERROR_CODE,
  QUIZ_STATUS,
  type ProjectDto,
  type QuizDto,
} from '@quizmb/contracts';
import { createApp } from '../src/app.js';
import { MemoryMailbox } from '../src/infrastructure/email.js';
import { createLogger } from '../src/infrastructure/logger.js';
import {
  DOMAIN_EVENT,
  DomainEvents,
} from '../src/infrastructure/domain-events.js';
import { AuthRepository } from '../src/modules/auth/repository.js';
import { AuthService } from '../src/modules/auth/service.js';
import { parseAuthEnv } from '../src/modules/auth/config.js';
import { UsersService } from '../src/modules/users/service.js';
import { signUpVerified } from './auth-helper.js';

// Settings: change the password (other devices signed out, this one kept)
// and delete the account (password and typed confirmation; refused while
// other people depend on the account; everything owned removed).
test(
  'settings: change password and delete account',
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
    const events = new DomainEvents();
    const revoked: string[][] = [];
    events.on(DOMAIN_EVENT.authSessionsRevoked, ({ familyIds }) =>
      revoked.push(familyIds),
    );
    const removedFiles: string[][] = [];
    const origin = 'http://localhost:3000';
    const server = createApp({
      allowedOrigins: [origin],
      logger: createLogger('silent'),
      auth: new AuthService(
        new AuthRepository(db),
        config,
        mailbox,
        {},
        {
          events,
        },
      ),
      users: new UsersService(
        db,
        { removeFiles: async (paths) => void removedFiles.push(paths) },
        events,
      ),
      database: db,
      events,
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const run = randomUUID();
    const emailOf = (who: string) => `settings-${who}-${run}@example.invalid`;
    const mine = { email: { endsWith: `-${run}@example.invalid` } };
    t.after(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await db.quiz.deleteMany({ where: { creator: mine } });
      await db.project.deleteMany({ where: { owner: mine } });
      await db.user.deleteMany({ where: mine });
      await db.$disconnect();
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
    const cookiesOf = (response: Response) =>
      response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
    const refused = async (response: Response, status: number) => {
      const body = (await response.json()) as {
        error: {
          code: string;
          message: string;
          details?: Record<string, string>;
        };
      };
      assert.equal(response.status, status, JSON.stringify(body));
      return body.error;
    };
    const password = 'a sufficiently long settings password';
    const signUp = async (who: string) =>
      cookiesOf(
        await signUpVerified(request, mailbox, {
          name: `Settings ${who}`,
          email: emailOf(who),
          password,
        }),
      );
    const login = async (who: string, pass = password) =>
      request('/auth/login', 'POST', { email: emailOf(who), password: pass });

    // ---- Change password: this device stays, the other one is signed out.
    const laptop = await signUp('owner');
    const phone = cookiesOf(await login('owner'));
    const wrong = await refused(
      await request(
        '/me/password',
        'POST',
        { currentPassword: 'not the password', newPassword: `${password}!` },
        laptop,
      ),
      422,
    );
    assert.equal(wrong.code, ERROR_CODE.VALIDATION_ERROR);
    assert.ok(wrong.details?.currentPassword, 'the field is marked');
    assert.ok(
      (
        await refused(
          await request(
            '/me/password',
            'POST',
            { currentPassword: password, newPassword: 'short' },
            laptop,
          ),
          422,
        )
      ).details?.newPassword,
      'the new password follows the signup rules',
    );
    const newPassword = 'a brand new and long settings password';
    const sentBefore = mailbox.messages.length;
    const changed = await request(
      '/me/password',
      'POST',
      { currentPassword: password, newPassword },
      laptop,
    );
    assert.equal(changed.status, 200);
    assert.equal((await request('/me', 'GET', undefined, laptop)).status, 200);
    assert.equal(
      (await request('/me', 'GET', undefined, phone)).status,
      401,
      'the other device is signed out',
    );
    assert.equal(
      (await request('/auth/refresh', 'POST', {}, phone)).status,
      401,
      'and cannot renew',
    );
    assert.equal(
      (await request('/auth/refresh', 'POST', {}, laptop)).status,
      200,
      'this device keeps renewing',
    );
    assert.ok(revoked.length >= 1, 'the other device’s sockets are closed');
    assert.ok(
      mailbox.messages
        .slice(sentBefore)
        .some(
          (message) =>
            message.to === emailOf('owner') &&
            /password was changed/.test(message.subject),
        ),
      'the owner is told',
    );
    assert.equal((await login('owner')).status, 401, 'old password refused');
    const current = cookiesOf(await login('owner', newPassword));
    assert.ok(current, 'new password works');

    // ---- Delete account: confirmation and password are both required.
    assert.equal(
      (
        await refused(
          await request(
            '/me/delete',
            'POST',
            { confirmation: 'delete', password: newPassword },
            current,
          ),
          422,
        )
      ).code,
      ERROR_CODE.VALIDATION_ERROR,
      'DELETE is case-sensitive',
    );
    assert.ok(
      (
        await refused(
          await request(
            '/me/delete',
            'POST',
            { confirmation: 'DELETE', password: 'not the password' },
            current,
          ),
          422,
        )
      ).details?.password,
    );

    // ---- Refused while other people depend on the account.
    const project = (
      (await (
        await request(
          '/projects',
          'POST',
          { name: 'Doomed', description: '' },
          current,
        )
      ).json()) as { data: ProjectDto }
    ).data;
    const quiz = (
      (await (
        await request(
          `/projects/${project.id}/quizzes`,
          'POST',
          {
            title: 'Doomed quiz',
            description: '',
            registrationLimit: 10,
            defaultQuestionDurationSeconds: 20,
            allowLateJoin: true,
            coverMediaId: null,
            plannedStartAt: '2030-01-01T10:00:00Z',
          },
          current,
        )
      ).json()) as { data: QuizDto }
    ).data;
    const owner = await db.user.findUniqueOrThrow({
      where: { email: emailOf('owner') },
    });
    const confirm = { confirmation: 'DELETE', password: newPassword };
    await db.quiz.update({
      where: { id: quiz.id },
      data: { status: QUIZ_STATUS.PUBLISHED },
    });
    assert.match(
      (
        await refused(
          await request('/me/delete', 'POST', confirm, current),
          409,
        )
      ).message,
      /host a quiz/,
    );
    // A participant registered for that quiz is refused too.
    const participant = await signUp('participant');
    const participantUser = await db.user.findUniqueOrThrow({
      where: { email: emailOf('participant') },
    });
    await db.quizRegistration.create({
      data: { quizId: quiz.id, userId: participantUser.id },
    });
    assert.match(
      (
        await refused(
          await request(
            '/me/delete',
            'POST',
            { confirmation: 'DELETE', password },
            participant,
          ),
          409,
        )
      ).message,
      /registered for a quiz/,
    );

    // ---- Once the quiz is finished, everything owned goes.
    await db.quiz.update({
      where: { id: quiz.id },
      data: { status: QUIZ_STATUS.COMPLETED },
    });
    await db.mediaAsset.create({
      data: {
        ownerUserId: owner.id,
        quizId: quiz.id,
        purpose: 'QUIZ_COVER',
        bucket: 'settings-test',
        objectPath: `${owner.id}/${quiz.id}/cover.png`,
        fileName: 'cover.png',
        mimeType: 'image/png',
        sizeBytes: 100,
        status: 'READY',
      },
    });
    revoked.length = 0;
    const deleted = await request('/me/delete', 'POST', confirm, current);
    assert.equal(deleted.status, 204);
    assert.ok(
      deleted.headers
        .getSetCookie()
        .some((value) => /Expires=Thu, 01 Jan 1970/i.test(value)),
      'the cookies are cleared',
    );
    assert.equal(
      await db.user.count({ where: { id: owner.id } }),
      0,
      'the user is gone',
    );
    assert.equal(
      await db.project.count({ where: { ownerUserId: owner.id } }),
      0,
    );
    assert.equal(
      await db.quiz.count({ where: { creatorUserId: owner.id } }),
      0,
    );
    assert.equal(
      await db.quizRegistration.count({ where: { quizId: quiz.id } }),
      0,
      'registrations in the deleted quiz go with it',
    );
    assert.deepEqual(removedFiles.flat(), [`${owner.id}/${quiz.id}/cover.png`]);
    assert.ok(revoked.flat().length >= 1, 'live sockets are closed');
    assert.equal((await request('/me', 'GET', undefined, current)).status, 401);
    assert.equal((await login('owner', newPassword)).status, 401);
    // The participant no longer depends on anything: they can leave too.
    assert.equal(
      (
        await request(
          '/me/delete',
          'POST',
          { confirmation: 'DELETE', password },
          participant,
        )
      ).status,
      204,
    );
  },
);
