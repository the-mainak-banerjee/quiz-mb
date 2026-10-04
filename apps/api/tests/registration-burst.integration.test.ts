import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase } from '@quizmb/database';
import { ERROR_CODE, QUIZ_STATUS } from '@quizmb/contracts';
import { parseAuthEnv } from '../src/modules/auth/config.js';
import { RegistrationsRepository } from '../src/modules/registrations/repository.js';

// Many people registering the moment a link is shared: everyone gets an
// answer quickly and capacity is never exceeded.
const BURST = 100;
const LIMIT = 40;

test(
  'a registration burst is fast, exact on capacity and reuses cancelled rows',
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Development integration tests only');
    const config = parseAuthEnv(process.env);
    const db = createDatabase(
      config.DATABASE_URL,
      config.DATABASE_SSL_CA_BASE64,
    );
    const tag = `burst-${randomUUID()}`;
    const emails = Array.from(
      { length: BURST + 1 },
      (_, index) => `${tag}-${index}@example.invalid`,
    );
    t.after(async () => {
      const ids = (
        await db.user.findMany({
          where: { email: { in: emails } },
          select: { id: true },
        })
      ).map((user) => user.id);
      await db.quiz.deleteMany({ where: { creatorUserId: { in: ids } } });
      await db.project.deleteMany({ where: { ownerUserId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await db.$disconnect();
    });

    // Fixture rows are written directly; only registration goes through
    // the code under test.
    await db.user.createMany({
      data: emails.map((email) => ({
        name: 'Burst',
        email,
        passwordHash: 'not-a-real-hash',
      })),
    });
    const users = await db.user.findMany({
      where: { email: { in: emails } },
      select: { id: true, email: true },
    });
    const host = users.find((user) => user.email === emails[0])!;
    const participants = users.filter((user) => user.id !== host.id);
    const project = await db.project.create({
      data: { ownerUserId: host.id, name: 'Burst' },
    });
    const quiz = await db.quiz.create({
      data: {
        publicId: tag.slice(0, 24),
        projectId: project.id,
        creatorUserId: host.id,
        title: 'Registration burst',
        registrationLimit: LIMIT,
        defaultQuestionDurationSeconds: 20,
        plannedStartAt: new Date(),
        status: QUIZ_STATUS.PUBLISHED,
      },
    });
    const registrations = new RegistrationsRepository(db);

    const started = Date.now();
    const outcomes = await Promise.all(
      participants.map((user) =>
        registrations.register(quiz.id, user.id).then(
          (result) => ({ code: 'OK', count: result.registrationCount }),
          (error: { code?: string }) => ({ code: error.code, count: 0 }),
        ),
      ),
    );
    const elapsed = Date.now() - started;
    const codes = outcomes.map((outcome) => outcome.code);
    assert.equal(codes.filter((code) => code === 'OK').length, LIMIT);
    assert.equal(
      codes.filter((code) => code === ERROR_CODE.QUIZ_FULL).length,
      BURST - LIMIT,
      'everyone else is told the quiz is full; nothing fails',
    );
    assert.deepEqual(
      outcomes
        .filter((outcome) => outcome.code === 'OK')
        .map((outcome) => outcome.count)
        .sort((a, b) => a - b),
      Array.from({ length: LIMIT }, (_, index) => index + 1),
      'each success reports its own position',
    );
    assert.equal(
      await db.quizRegistration.count({
        where: { quizId: quiz.id, status: 'REGISTERED' },
      }),
      LIMIT,
    );
    assert.equal(
      await db.projectAssociation.count({ where: { projectId: project.id } }),
      LIMIT,
    );
    assert.ok(elapsed < 20_000, `the burst took ${elapsed} ms`);

    // A cancelled seat is reused by the same row when its owner returns.
    const seated = await db.quizRegistration.findFirstOrThrow({
      where: { quizId: quiz.id, status: 'REGISTERED' },
    });
    await registrations.unregister(quiz.id, seated.userId);
    const again = await registrations.register(quiz.id, seated.userId);
    assert.equal(again.registration.id, seated.id);
    assert.equal(again.registrationCount, LIMIT);
    await assert.rejects(registrations.register(quiz.id, seated.userId), {
      code: ERROR_CODE.ALREADY_REGISTERED,
    });
    await assert.rejects(registrations.register(quiz.id, host.id), {
      code: ERROR_CODE.HOST_CANNOT_REGISTER,
    });

    // Supabase's Data API roles cannot call the function directly.
    const [privileges] = await db.$queryRaw<
      { anon: boolean | null; authenticated: boolean | null }[]
    >`SELECT
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
          THEN has_function_privilege('anon', 'register_participant(uuid, uuid)', 'EXECUTE') END AS anon,
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
          THEN has_function_privilege('authenticated', 'register_participant(uuid, uuid)', 'EXECUTE') END AS authenticated`;
    assert.notEqual(privileges?.anon, true);
    assert.notEqual(privileges?.authenticated, true);
  },
);
