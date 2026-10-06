import { test, type TestContext } from 'node:test';
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
import { MemoryMailbox } from '../src/infrastructure/email.js';
import { signUpVerified } from './auth-helper.js';
import { createLogger } from '../src/infrastructure/logger.js';
import { AuthRepository } from '../src/modules/auth/repository.js';
import { AuthService } from '../src/modules/auth/service.js';
import { parseAuthEnv } from '../src/modules/auth/config.js';
import { UsersService } from '../src/modules/users/service.js';

const validQuestion = {
  type: 'SINGLE_CHOICE',
  text: 'Which value is correct?',
  durationOverrideSeconds: null,
  imageMediaId: null,
  options: [
    { text: 'A', isCorrect: true },
    { text: 'B', isCorrect: false },
  ],
};

const quizBasics = {
  title: 'Capacity-safe quiz',
  description: 'A public-safe publishing fixture.',
  registrationLimit: 1,
  defaultQuestionDurationSeconds: 30,
  allowLateJoin: false,
  coverMediaId: null,
  plannedStartAt: '2030-10-24T19:00:00Z',
};

async function startPublishingHarness(t: TestContext, userCount: number) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Development integration tests only');
  const config = parseAuthEnv(process.env);
  const db = createDatabase(config.DATABASE_URL, config.DATABASE_SSL_CA_BASE64);
  const mailbox = new MemoryMailbox();
  const auth = new AuthService(new AuthRepository(db), config, mailbox);
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
  const emails = Array.from(
    { length: userCount },
    (_, index) =>
      `publishing-${index ? `participant-${index}` : 'host'}-${randomUUID()}@example.invalid`,
  );
  const request = (path: string, method = 'GET', body?: unknown, cookie = '') =>
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
  const errorCode = async (response: Response) =>
    ((await response.json()) as { error: { code: string } }).error.code;

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
    const response = await signUpVerified(request, mailbox, {
      name: index ? `Participant ${index}` : 'Quiz Host',
      email,
      password: 'a strong publishing test password',
    });
    assert.equal(response.status, 200);
    cookies.push(
      response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; '),
    );
  }
  return { db, emails, cookies, request, data, errorCode };
}

test(
  'publishing and registration lifecycle is public-safe and capacity-safe',
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const { db, emails, cookies, request, data } = await startPublishingHarness(
      t,
      3,
    );
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
    let quiz = await data<QuizDto>(
      await request(
        `/projects/${project.id}/quizzes`,
        'POST',
        quizBasics,
        host,
      ),
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
        validQuestion,
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

test(
  'publishing is blocked until the quiz has a planned date and time',
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const { db, cookies, request, data, errorCode } =
      await startPublishingHarness(t, 2);
    const host = cookies[0]!;
    const participant = cookies[1]!;
    const project = await data<{ id: string }>(
      await request(
        '/projects',
        'POST',
        { name: 'Planned date project', description: 'Integration fixture' },
        host,
      ),
      201,
    );
    const withoutDate: Partial<typeof quizBasics> = { ...quizBasics };
    delete withoutDate.plannedStartAt;
    const rejectedCreate = await request(
      `/projects/${project.id}/quizzes`,
      'POST',
      withoutDate,
      host,
    );
    assert.equal(rejectedCreate.status, 422);

    let quiz = await data<QuizDto>(
      await request(
        `/projects/${project.id}/quizzes`,
        'POST',
        quizBasics,
        host,
      ),
      201,
    );
    quiz = await data<QuizDto>(
      await request(
        `/quizzes/${quiz.id}/questions`,
        'POST',
        validQuestion,
        host,
      ),
      201,
    );
    const clearDate = await request(
      `/quizzes/${quiz.id}`,
      'PATCH',
      { ...quizBasics, plannedStartAt: null },
      host,
    );
    assert.equal(clearDate.status, 422);

    // Drafts saved before plannedStartAt became required can still hold null.
    await db.quiz.update({
      where: { id: quiz.id },
      data: { plannedStartAt: null },
    });
    const rejected = await request(
      `/quizzes/${quiz.id}/publish`,
      'POST',
      {},
      host,
    );
    assert.equal(rejected.status, 422);
    const rejectedBody = (await rejected.json()) as {
      error: { code: string; details?: Record<string, string> };
    };
    assert.equal(rejectedBody.error.code, 'VALIDATION_ERROR');
    assert.ok(rejectedBody.error.details?.plannedStartAt);

    const stored = await db.quiz.findUniqueOrThrow({
      where: { id: quiz.id },
      select: { status: true, publishedAt: true },
    });
    assert.equal(stored.status, 'DRAFT');
    assert.equal(stored.publishedAt, null);
    // The database itself refuses a non-draft quiz without a planned start.
    await assert.rejects(
      db.quiz.update({
        where: { id: quiz.id },
        data: { status: 'PUBLISHED', publishedAt: new Date() },
      }),
      /quiz_planned_start_required/,
    );
    assert.equal(
      (await request(`/public/quizzes/${quiz.publicId}`)).status,
      404,
    );
    const registration = await request(
      `/quizzes/${quiz.id}/register`,
      'POST',
      {},
      participant,
    );
    assert.equal(registration.status, 409);
    assert.equal(await errorCode(registration), 'REGISTRATION_CLOSED');

    await data<QuizDto>(
      await request(`/quizzes/${quiz.id}`, 'PATCH', quizBasics, host),
    );
    quiz = await data<QuizDto>(
      await request(`/quizzes/${quiz.id}/publish`, 'POST', {}, host),
    );
    assert.equal(quiz.status, 'PUBLISHED');
    assert.equal(
      (
        await request(
          `/quizzes/${quiz.id}`,
          'PATCH',
          { ...quizBasics, plannedStartAt: null },
          host,
        )
      ).status,
      422,
    );
    await assert.rejects(
      db.quiz.update({
        where: { id: quiz.id },
        data: { plannedStartAt: null },
      }),
      /quiz_planned_start_required/,
    );
  },
);

test(
  'concurrent registrations never exceed the registration limit',
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const limit = 3;
    const { db, cookies, request, data, errorCode } =
      await startPublishingHarness(t, 9);
    const host = cookies[0]!;
    const participants = cookies.slice(1);
    const project = await data<{ id: string }>(
      await request(
        '/projects',
        'POST',
        { name: 'Concurrency project', description: 'Integration fixture' },
        host,
      ),
      201,
    );
    let quiz = await data<QuizDto>(
      await request(
        `/projects/${project.id}/quizzes`,
        'POST',
        { ...quizBasics, registrationLimit: limit },
        host,
      ),
      201,
    );
    await data<QuizDto>(
      await request(
        `/quizzes/${quiz.id}/questions`,
        'POST',
        validQuestion,
        host,
      ),
      201,
    );
    quiz = await data<QuizDto>(
      await request(`/quizzes/${quiz.id}/publish`, 'POST', {}, host),
    );

    const register = (cookie: string) =>
      request(`/quizzes/${quiz.id}/register`, 'POST', {}, cookie);
    const activeCount = () =>
      db.quizRegistration.count({
        where: { quizId: quiz.id, status: 'REGISTERED' },
      });
    const settle = async (responses: Response[]) =>
      Promise.all(
        responses.map(async (response) => ({
          status: response.status,
          code: response.status === 201 ? null : await errorCode(response),
        })),
      );

    // Every participant races for three seats; the first also double-submits.
    const burst = await settle(
      await Promise.all([
        ...participants.map(register),
        register(participants[0]!),
      ]),
    );
    assert.equal(burst.filter((r) => r.status === 201).length, limit);
    for (const rejected of burst.filter((r) => r.status !== 201)) {
      assert.equal(rejected.status, 409, JSON.stringify(rejected));
      assert.ok(
        ['QUIZ_FULL', 'ALREADY_REGISTERED'].includes(rejected.code!),
        JSON.stringify(rejected),
      );
    }
    assert.equal(await activeCount(), limit);
    const publicQuiz = await data<PublicQuizDto>(
      await request(`/public/quizzes/${quiz.publicId}`),
    );
    assert.equal(publicQuiz.registrationCount, limit);
    assert.equal(publicQuiz.isFull, true);

    // Releasing one seat lets exactly one of the waiting participants in.
    const statuses = await Promise.all(
      participants.map(
        async (cookie) =>
          (
            await data<RegistrationDto>(
              await request(
                `/quizzes/${quiz.id}/registration`,
                'GET',
                undefined,
                cookie,
              ),
            )
          ).registered,
      ),
    );
    const registered = participants.filter((_, index) => statuses[index]);
    const waiting = participants.filter((_, index) => !statuses[index]);
    assert.equal(registered.length, limit);
    await data<RegistrationDto>(
      await request(
        `/quizzes/${quiz.id}/register`,
        'DELETE',
        undefined,
        registered[0]!,
      ),
    );
    const retry = await settle(await Promise.all(waiting.map(register)));
    assert.equal(retry.filter((r) => r.status === 201).length, 1);
    assert.ok(
      retry
        .filter((r) => r.status !== 201)
        .every((r) => r.status === 409 && r.code === 'QUIZ_FULL'),
      JSON.stringify(retry),
    );
    assert.equal(await activeCount(), limit);
  },
);

test(
  'published quizzes keep a question, never drop below their registrations, and fix questions once the lobby opens',
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    const { db, cookies, request, data } = await startPublishingHarness(t, 3);
    const [host, participantA, participantB] = cookies as [
      string,
      string,
      string,
    ];
    const refusal = async (response: Response, status: number) => {
      const body = (await response.json()) as {
        error: { code: string; details?: Record<string, string> };
      };
      assert.equal(response.status, status, JSON.stringify(body));
      return body.error;
    };

    const project = await data<{ id: string }>(
      await request(
        '/projects',
        'POST',
        { name: 'Content rules project', description: 'Integration fixture' },
        host,
      ),
      201,
    );
    const basics = { ...quizBasics, registrationLimit: 5 };
    let quiz = await data<QuizDto>(
      await request(`/projects/${project.id}/quizzes`, 'POST', basics, host),
      201,
    );
    for (const text of ['First question?', 'Second question?'])
      quiz = await data<QuizDto>(
        await request(
          `/quizzes/${quiz.id}/questions`,
          'POST',
          { ...validQuestion, text },
          host,
        ),
        201,
      );
    const [first, second] = quiz.questions as [
      QuizDto['questions'][number],
      QuizDto['questions'][number],
    ];
    quiz = await data<QuizDto>(
      await request(`/quizzes/${quiz.id}/publish`, 'POST', {}, host),
    );
    for (const participant of [participantA, participantB])
      await data<RegistrationDto>(
        await request(`/quizzes/${quiz.id}/register`, 'POST', {}, participant),
        201,
      );

    // The registration limit cannot drop below the confirmed registrations.
    const tooLow = await refusal(
      await request(
        `/quizzes/${quiz.id}`,
        'PATCH',
        { ...basics, registrationLimit: 1 },
        host,
      ),
      422,
    );
    assert.equal(tooLow.code, 'VALIDATION_ERROR');
    assert.ok(tooLow.details?.registrationLimit);
    quiz = await data<QuizDto>(
      await request(
        `/quizzes/${quiz.id}`,
        'PATCH',
        { ...basics, registrationLimit: 2 },
        host,
      ),
    );
    assert.equal(quiz.registrationLimit, 2, 'equal to the count is allowed');
    assert.equal(quiz.registrationCount, 2, 'the host sees the count');

    // A published quiz keeps at least one question.
    await data(
      await request(`/questions/${first.id}`, 'DELETE', undefined, host),
    );
    const lastQuestion = await refusal(
      await request(`/questions/${second.id}`, 'DELETE', undefined, host),
      422,
    );
    assert.equal(lastQuestion.code, 'VALIDATION_ERROR');
    assert.ok(lastQuestion.details?.questions);
    assert.equal(await db.question.count({ where: { quizId: quiz.id } }), 1);

    // Once the lobby is open, questions and question images are fixed while
    // quiz details stay editable until the quiz goes live.
    await db.quiz.update({
      where: { id: quiz.id },
      data: { status: 'LOBBY' },
    });
    const locked = () => [
      () =>
        request(
          `/quizzes/${quiz.id}/questions`,
          'POST',
          { ...validQuestion, text: 'Added in the lobby?' },
          host,
        ),
      () =>
        request(
          `/questions/${second.id}`,
          'PATCH',
          { ...validQuestion, text: 'Changed in the lobby?' },
          host,
        ),
      () => request(`/questions/${second.id}`, 'DELETE', undefined, host),
      () =>
        request(
          `/quizzes/${quiz.id}/questions/reorder`,
          'POST',
          { questionIds: [second.id] },
          host,
        ),
      () =>
        request(
          '/media/upload-request',
          'POST',
          {
            purpose: 'QUESTION_IMAGE',
            fileName: 'question.png',
            mimeType: 'image/png',
            sizeBytes: 100,
            resource: { quizId: quiz.id },
          },
          host,
        ),
    ];
    // Sent together: edits queue on the quiz row lock instead of timing out.
    const responses = await Promise.all(locked().map((send) => send()));
    for (const [index, response] of responses.entries())
      assert.equal(
        (await refusal(response, 409)).code,
        'QUIZ_LOCKED',
        `locked request ${index}`,
      );
    const renamed = await data<QuizDto>(
      await request(
        `/quizzes/${quiz.id}`,
        'PATCH',
        { ...basics, registrationLimit: 2, title: 'Renamed in the lobby' },
        host,
      ),
    );
    assert.equal(renamed.title, 'Renamed in the lobby');
    assert.equal(renamed.questions[0]?.text, 'Second question?');

    // Drafts may still remove their last question.
    const draft = await data<QuizDto>(
      await request(
        `/projects/${project.id}/quizzes`,
        'POST',
        quizBasics,
        host,
      ),
      201,
    );
    const withQuestion = await data<QuizDto>(
      await request(
        `/quizzes/${draft.id}/questions`,
        'POST',
        validQuestion,
        host,
      ),
      201,
    );
    await data(
      await request(
        `/questions/${withQuestion.questions[0]!.id}`,
        'DELETE',
        undefined,
        host,
      ),
    );
  },
);
