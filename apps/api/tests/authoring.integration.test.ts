import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createDatabase } from '@quizmb/database';
import type {
  ProjectDto,
  QuizDto,
  UploadDto,
  MediaDto,
} from '@quizmb/contracts';
import { createApp } from '../src/app.js';
import { createLogger } from '../src/infrastructure/logger.js';
import { AuthRepository } from '../src/modules/auth/repository.js';
import { AuthService } from '../src/modules/auth/service.js';
import { parseAuthEnv } from '../src/modules/auth/config.js';
import { createStorage } from '../src/modules/media/storage.js';
import { UsersService } from '../src/modules/users/service.js';

test(
  'authoring HTTP lifecycle: ownership, atomic ordering, draft-only saves, private media',
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
    const storage = createStorage(process.env);
    const origin = 'http://localhost:3000';
    const server = createApp({
      allowedOrigins: [origin],
      logger: createLogger('silent'),
      auth,
      users: new UsersService(db),
      database: db,
      ...(storage ? { storage } : {}),
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const emails = [0, 1].map(
      () => `authoring-${randomUUID()}@example.invalid`,
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
      const ids = users.map((u) => u.id);
      const assets = await db.mediaAsset.findMany({
        where: { ownerUserId: { in: ids } },
      });
      if (storage && assets.length)
        await storage.client
          .from(storage.bucket)
          .remove(assets.map((a) => a.objectPath));
      await db.quiz.deleteMany({ where: { creatorUserId: { in: ids } } });
      await db.project.deleteMany({ where: { ownerUserId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await db.$disconnect();
    });
    const cookies: string[] = [];
    for (const email of emails) {
      const r = await request('/auth/signup', 'POST', {
        name: 'Authoring test',
        email,
        password: 'a strong authoring test password',
      });
      assert.equal(r.status, 201);
      cookies.push(
        r.headers
          .getSetCookie()
          .map((c) => c.split(';')[0])
          .join('; '),
      );
    }
    const owner = cookies[0]!,
      other = cookies[1]!;
    assert.equal((await request('/projects')).status, 401);
    const project = await data<ProjectDto>(
      await request(
        '/projects',
        'POST',
        { name: 'Test project', description: 'Fixture only' },
        owner,
      ),
      201,
    );
    assert.equal(
      (await request(`/projects/${project.id}`, 'GET', undefined, other))
        .status,
      404,
    );
    const basics = {
      title: 'Test draft',
      description: '',
      registrationLimit: 50,
      defaultQuestionDurationSeconds: 30,
      allowLateJoin: false,
      coverMediaId: null,
      plannedStartAt: '2030-01-01T10:00:00Z',
    };
    assert.equal(
      (await request(`/projects/${project.id}/quizzes`, 'POST', basics, other))
        .status,
      404,
    );
    let quiz = await data<QuizDto>(
      await request(`/projects/${project.id}/quizzes`, 'POST', basics, owner),
      201,
    );
    assert.equal(quiz.status, 'DRAFT');
    assert.equal(
      (
        await request(
          `/quizzes/${quiz.id}`,
          'PATCH',
          { ...basics, status: 'PUBLISHED' },
          owner,
        )
      ).status,
      422,
    );
    assert.equal(
      (await request(`/quizzes/${quiz.id}`, 'GET', undefined, other)).status,
      404,
    );
    const single = {
      type: 'SINGLE_CHOICE',
      text: '**Choose** one',
      durationOverrideSeconds: null,
      imageMediaId: null,
      options: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    };
    quiz = await data<QuizDto>(
      await request(`/quizzes/${quiz.id}/questions`, 'POST', single, owner),
      201,
    );
    const first = quiz.questions[0]!.id;
    assert.equal(
      (await request(`/questions/${first}`, 'PATCH', single, other)).status,
      404,
    );
    assert.equal(
      (
        await request(
          `/questions/${first}`,
          'PATCH',
          { ...single, options: [] },
          owner,
        )
      ).status,
      422,
    );
    const races = await Promise.all([
      request(
        `/quizzes/${quiz.id}/questions`,
        'POST',
        { ...single, type: 'MULTIPLE_CHOICE' },
        owner,
      ),
      request(
        `/quizzes/${quiz.id}/questions`,
        'POST',
        { ...single, type: 'DESCRIPTIVE', options: [] },
        owner,
      ),
    ]);
    assert.deepEqual(
      races.map((r) => r.status),
      [201, 201],
    );
    quiz = await data<QuizDto>(
      await request(`/quizzes/${quiz.id}`, 'GET', undefined, owner),
    );
    assert.deepEqual(
      quiz.questions.map((q) => q.position),
      [0, 1, 2],
    );
    const reversed = quiz.questions.map((q) => q.id).reverse();
    quiz = await data<QuizDto>(
      await request(
        `/quizzes/${quiz.id}/questions/reorder`,
        'POST',
        { questionIds: reversed },
        owner,
      ),
    );
    assert.deepEqual(
      quiz.questions.map((q) => q.id),
      reversed,
    );
    assert.equal(
      (
        await request(
          `/quizzes/${quiz.id}/questions/reorder`,
          'POST',
          { questionIds: [first, first, first] },
          owner,
        )
      ).status,
      422,
    );
    quiz = await data<QuizDto>(
      await request(`/questions/${first}`, 'DELETE', undefined, owner),
    );
    assert.deepEqual(
      quiz.questions.map((q) => q.position),
      [0, 1],
    );
    await t.test(
      'real signed upload, private reads, attachment ownership and deletion',
      { skip: !storage },
      async () => {
        const png = Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9kAAAAASUVORK5CYII=',
          'base64',
        );
        const uploadInput = {
          purpose: 'QUIZ_COVER',
          fileName: 'probe.png',
          mimeType: 'image/png',
          sizeBytes: png.length,
          resource: { quizId: quiz.id },
        };
        const ticket = await data<UploadDto>(
          await request('/media/upload-request', 'POST', uploadInput, owner),
          201,
        );
        const upload = await fetch(ticket.upload.url, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/png' },
          body: png,
        });
        assert.ok(upload.ok, `Signed upload status ${upload.status}`);
        const asset = await data<MediaDto>(
          await request(`/media/${ticket.mediaId}/complete`, 'POST', {}, owner),
        );
        assert.equal(
          (
            await request(
              `/media/${ticket.mediaId}/complete`,
              'POST',
              {},
              other,
            )
          ).status,
          404,
        );
        assert.equal((await fetch(asset.url)).status, 200);
        const publicUrl = storage!.client
          .from(storage!.bucket)
          .getPublicUrl(ticket.upload.path).data.publicUrl;
        assert.equal((await fetch(publicUrl)).ok, false);
        quiz = await data<QuizDto>(
          await request(
            `/quizzes/${quiz.id}`,
            'PATCH',
            { ...basics, coverMediaId: asset.id },
            owner,
          ),
        );
        assert.equal(quiz.cover?.id, asset.id);
        assert.equal(
          (await request(`/media/${asset.id}`, 'DELETE', undefined, owner))
            .status,
          409,
        );
        await data<QuizDto>(
          await request(`/quizzes/${quiz.id}`, 'PATCH', basics, owner),
        );
        assert.equal(
          (await request(`/media/${asset.id}`, 'DELETE', undefined, owner))
            .status,
          204,
        );
      },
    );
    await db.quiz.update({ where: { id: quiz.id }, data: { status: 'LIVE' } });
    assert.equal(
      (await request(`/quizzes/${quiz.id}`, 'PATCH', basics, owner)).status,
      409,
    );
    assert.equal(
      (await request(`/quizzes/${quiz.id}/questions`, 'POST', single, owner))
        .status,
      409,
    );
    const rls = await db.$queryRaw<
      Array<{ relrowsecurity: boolean }>
    >`SELECT relrowsecurity FROM pg_class WHERE oid IN ('projects'::regclass, 'quizzes'::regclass, 'questions'::regclass, 'question_options'::regclass, 'media_assets'::regclass)`;
    assert.equal(rls.length, 5);
    assert.ok(rls.every((row) => row.relrowsecurity));
  },
);
