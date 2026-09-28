import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createDatabase } from '@quizmb/database';
import type {
  HostDashboardDto,
  HostRegistrationDto,
  ParticipantDashboardDto,
  PublicQuizDto,
  QuizDto,
  RegistrationDto,
} from '@quizmb/contracts';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/infrastructure/logger.js';
import { AuthRepository } from '../src/modules/auth/repository.js';
import { AuthService } from '../src/modules/auth/service.js';
import { parseAuthEnv } from '../src/modules/auth/config.js';
import { UsersService } from '../src/modules/users/service.js';

test(
  'publishing and registration lifecycle is public-safe and capacity-safe',
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Development integration tests only');
    const config = parseAuthEnv(process.env);
    const db = createDatabase(
      config.DATABASE_URL,
      config.DATABASE_SSL_CA_BASE64,
    );
    const auth = new AuthService(new AuthRepository(db), config);
    const origin = 'http://localhost:3000';
    const server = createApp({
      allowedOrigins: [origin],
      logger: createLogger('silent'),
      auth,
      users: new UsersService(db),
      database: db,
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const emails = ['host', 'participant-a', 'participant-b'].map(
      (role) => `publishing-${role}-${randomUUID()}@example.invalid`,
    );
    const request = (
      path: string,
      method = 'GET',
      body?: unknown,
      cookie = '',
    ) =>
      fetch(base + '/api' + path, {
        method,
        headers: {
          Origin: origin,
          'Content-Type': 'application/json',
          Cookie: cookie,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    const data = async <T>(response: Response, status = 200): Promise<T> => {
      const body = (await response.json()) as { data: T };
      assert.equal(response.status, status, JSON.stringify(body));
      return body.data;
    };

    t.after(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      const users = await db.user.findMany({
        where: { email: { in: emails } },
        select: { id: true },
      });
      const ids = users.map((user) => user.id);
      await db.quiz.deleteMany({ where: { creatorUserId: { in: ids } } });
      await db.project.deleteMany({ where: { ownerUserId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await db.$disconnect();
    });

    const cookies: string[] = [];
    for (const [index, email] of emails.entries()) {
      const response = await request('/auth/signup', 'POST', {
        name: index ? `Participant ${index}` : 'Quiz Host',
        email,
        password: 'a strong publishing test password',
      });
      assert.equal(response.status, 201);
      cookies.push(
        response.headers
          .getSetCookie()
          .map((value) => value.split(';')[0])
          .join('; '),
      );
    }
    const host = cookies[0]!;
    const participantA = cookies[1]!;
    const participantB = cookies[2]!;

    const project = await data<{ id: string }>(
      await request(
        '/projects',
        'POST',
        { name: 'Publishing project', description: 'Integration fixture' },
        host,
      ),
      201,
    );
    const basics = {
      title: 'Capacity-safe quiz',
      description: 'A public-safe publishing fixture.',
      registrationLimit: 1,
      defaultQuestionDurationSeconds: 30,
      allowLateJoin: false,
      coverMediaId: null,
      plannedStartAt: '2030-10-24T19:00:00Z',
    };
    let quiz = await data<QuizDto>(
      await request(`/projects/${project.id}/quizzes`, 'POST', basics, host),
      201,
    );
    assert.equal(
      (await request(`/public/quizzes/${quiz.publicId}`)).status,
      404,
    );
    assert.equal(
      (await request(`/quizzes/${quiz.id}/publish`, 'POST', {}, host)).status,
      422,
    );
    quiz = await data<QuizDto>(
      await request(
        `/quizzes/${quiz.id}/questions`,
        'POST',
        {
          type: 'SINGLE_CHOICE',
          text: 'Which value is correct?',
          durationOverrideSeconds: null,
          imageMediaId: null,
          options: [
            { text: 'A', isCorrect: true },
            { text: 'B', isCorrect: false },
          ],
        },
        host,
      ),
      201,
    );
    assert.equal(
      (await request(`/quizzes/${quiz.id}/publish`, 'POST', {}, participantA))
        .status,
      404,
    );
    quiz = await data<QuizDto>(
      await request(`/quizzes/${quiz.id}/publish`, 'POST', {}, host),
    );
    assert.equal(quiz.status, 'PUBLISHED');

    const hostRegistration = await request(
      `/quizzes/${quiz.id}/register`,
      'POST',
      {},
      host,
    );
    assert.equal(hostRegistration.status, 403);
    assert.equal(
      ((await hostRegistration.json()) as { error: { code: string } }).error
        .code,
      'HOST_CANNOT_REGISTER',
    );

    const publicResponse = await request(`/public/quizzes/${quiz.publicId}`);
    const publicQuiz = await data<PublicQuizDto>(publicResponse);
    assert.equal(publicQuiz.registrationCount, 0);
    assert.equal(publicQuiz.questionCount, 1);
    assert.equal(JSON.stringify(publicQuiz).includes('isCorrect'), false);

    const registration = await data<RegistrationDto>(
      await request(`/quizzes/${quiz.id}/register`, 'POST', {}, participantA),
      201,
    );
    assert.equal(registration.registered, true);
    assert.equal(registration.registrationCount, 1);

    const hostDashboard = await data<HostDashboardDto>(
      await request('/dashboard/host', 'GET', undefined, host),
    );
    assert.equal(hostDashboard.projects.length, 1);
    assert.equal(hostDashboard.projects[0]!.id, project.id);
    assert.equal(hostDashboard.projects[0]!.quizzes, 1);
    assert.equal(hostDashboard.projects[0]!.members, 2);
    assert.equal(hostDashboard.quizzes.length, 1);
    assert.equal(hostDashboard.quizzes[0]!.id, quiz.id);
    assert.equal(hostDashboard.quizzes[0]!.status, 'PUBLISHED');
    assert.equal(hostDashboard.quizzes[0]!.registrationCount, 1);

    assert.equal(
      (await request(`/quizzes/${quiz.id}/register`, 'POST', {}, participantA))
        .status,
      409,
    );
    assert.equal(
      (await request(`/quizzes/${quiz.id}/register`, 'POST', {}, participantB))
        .status,
      409,
    );

    const dashboard = await data<ParticipantDashboardDto>(
      await request('/dashboard/participant', 'GET', undefined, participantA),
    );
    assert.deepEqual(
      dashboard.upcoming.map((item) => item.id),
      [quiz.id],
    );
    const roster = await data<HostRegistrationDto[]>(
      await request(
        `/quizzes/${quiz.id}/registrations`,
        'GET',
        undefined,
        host,
      ),
    );
    assert.equal(roster.length, 1);
    assert.equal('email' in roster[0]!, false);

    const participantAUser = await db.user.findUniqueOrThrow({
      where: { email: emails[1]! },
    });
    assert.ok(
      await db.projectAssociation.findUnique({
        where: {
          projectId_userId: {
            projectId: project.id,
            userId: participantAUser.id,
          },
        },
      }),
    );

    const cancelled = await data<RegistrationDto>(
      await request(
        `/quizzes/${quiz.id}/register`,
        'DELETE',
        undefined,
        participantA,
      ),
    );
    assert.equal(cancelled.registered, false);
    assert.equal(cancelled.registrationCount, 0);
    assert.equal(
      (await request(`/quizzes/${quiz.id}/register`, 'POST', {}, participantB))
        .status,
      201,
    );
    assert.ok(
      await db.projectAssociation.findUnique({
        where: {
          projectId_userId: {
            projectId: project.id,
            userId: participantAUser.id,
          },
        },
      }),
    );
  },
);
