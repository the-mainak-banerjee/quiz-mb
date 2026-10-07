import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createDatabase } from '@quizmb/database';
import type {
  ProjectDto,
  QuizDto,
  QuizCreatedDto,
  UploadDto,
  MediaDto,
} from '@quizmb/contracts';
import { createApp } from '../src/app.js';
import { MemoryMailbox } from '../src/infrastructure/email.js';
import { signUpVerified } from './auth-helper.js';
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
    const mailbox = new MemoryMailbox();
    const auth = new AuthService(new AuthRepository(db), config, mailbox);
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
    const refusal = async (response: Response, status: number) => {
      const body = (await response.json()) as { error: { code: string } };
      assert.equal(response.status, status, JSON.stringify(body));
      return body.error;
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
      const r = await signUpVerified(request, mailbox, {
        name: 'Authoring test',
        email,
        password: 'a strong authoring test password',
      });
      assert.equal(r.status, 200);
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
      registrationLimit: 30,
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
        const put = (ticket: UploadDto, body: Buffer) =>
          fetch(ticket.upload.url, {
            method: 'PUT',
            headers: { 'Content-Type': 'image/png' },
            body,
          });
        const ticket = await data<UploadDto>(
          await request('/media/upload-request', 'POST', uploadInput, owner),
          201,
        );
        // Attaching before the file is uploaded is refused.
        assert.equal(
          (
            await refusal(
              await request(
                `/quizzes/${quiz.id}`,
                'PATCH',
                { ...basics, coverMediaId: ticket.mediaId },
                owner,
              ),
              422,
            )
          ).code,
          'UPLOAD_INCOMPLETE',
        );
        const upload = await put(ticket, png);
        assert.ok(upload.ok, `Signed upload status ${upload.status}`);
        // The separate completion step no longer exists.
        assert.equal(
          (
            await request(
              `/media/${ticket.mediaId}/complete`,
              'POST',
              {},
              owner,
            )
          ).status,
          404,
        );
        // Another user cannot attach it, even to a quiz of their own.
        assert.equal(
          (
            await request(
              `/quizzes/${quiz.id}`,
              'PATCH',
              { ...basics, coverMediaId: ticket.mediaId },
              other,
            )
          ).status,
          404,
        );
        // A cover upload is not a question image.
        assert.equal(
          (
            await request(
              `/quizzes/${quiz.id}/questions`,
              'POST',
              { ...single, imageMediaId: ticket.mediaId },
              owner,
            )
          ).status,
          422,
        );
        // A file that does not match its declared size is refused.
        const wrongSize = await data<UploadDto>(
          await request(
            '/media/upload-request',
            'POST',
            { ...uploadInput, sizeBytes: png.length + 1 },
            owner,
          ),
          201,
        );
        assert.ok((await put(wrongSize, png)).ok);
        assert.equal(
          (
            await refusal(
              await request(
                `/quizzes/${quiz.id}`,
                'PATCH',
                { ...basics, coverMediaId: wrongSize.mediaId },
                owner,
              ),
              422,
            )
          ).code,
          'INVALID_MEDIA',
        );
        // Attaching checks the stored file and makes the image ready.
        quiz = await data<QuizDto>(
          await request(
            `/quizzes/${quiz.id}`,
            'PATCH',
            { ...basics, coverMediaId: ticket.mediaId },
            owner,
          ),
        );
        const asset = quiz.cover as MediaDto;
        assert.equal(asset.id, ticket.mediaId);
        assert.equal((await fetch(asset.url)).status, 200);
        const publicUrl = storage!.client
          .from(storage!.bucket)
          .getPublicUrl(ticket.upload.path).data.publicUrl;
        assert.equal((await fetch(publicUrl)).ok, false);
        // Saving again with the ready cover keeps it.
        quiz = await data<QuizDto>(
          await request(
            `/quizzes/${quiz.id}`,
            'PATCH',
            { ...basics, coverMediaId: asset.id },
            owner,
          ),
        );
        assert.equal(quiz.cover?.id, asset.id);
        // A question image is checked when the question is saved.
        const imageTicket = await data<UploadDto>(
          await request(
            '/media/upload-request',
            'POST',
            { ...uploadInput, purpose: 'QUESTION_IMAGE' },
            owner,
          ),
          201,
        );
        assert.ok((await put(imageTicket, png)).ok);
        const withImage = await data<QuizDto>(
          await request(
            `/quizzes/${quiz.id}/questions`,
            'POST',
            { ...single, imageMediaId: imageTicket.mediaId },
            owner,
          ),
          201,
        );
        const imaged = withImage.questions.find(
          (q) => q.imageMediaId === imageTicket.mediaId,
        );
        assert.equal(imaged?.image?.id, imageTicket.mediaId);
        assert.equal((await fetch(imaged!.image!.url)).status, 200);
        await data<QuizDto>(
          await request(`/questions/${imaged!.id}`, 'DELETE', undefined, owner),
        );
        // Creating a quiz can request its cover upload in the same call.
        assert.equal(
          (
            await request(
              `/projects/${project.id}/quizzes`,
              'POST',
              { ...basics, cover: { ...uploadInput, purpose: undefined } },
              owner,
            )
          ).status,
          422,
        );
        const { fileName, mimeType, sizeBytes } = uploadInput;
        const created = await data<QuizCreatedDto>(
          await request(
            `/projects/${project.id}/quizzes`,
            'POST',
            { ...basics, cover: { fileName, mimeType, sizeBytes } },
            owner,
          ),
          201,
        );
        assert.ok(created.coverUpload, 'cover upload ticket');
        assert.equal(created.cover, null);
        assert.ok((await put(created.coverUpload, png)).ok);
        const covered = await data<QuizDto>(
          await request(
            `/quizzes/${created.id}`,
            'PATCH',
            { ...basics, coverMediaId: created.coverUpload.mediaId },
            owner,
          ),
        );
        assert.equal(covered.cover?.id, created.coverUpload.mediaId);
        const plain = await data<QuizCreatedDto>(
          await request(
            `/projects/${project.id}/quizzes`,
            'POST',
            basics,
            owner,
          ),
          201,
        );
        assert.equal(plain.coverUpload, null);
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
    // Deleting: only drafts, and only projects whose quizzes are all drafts.
    assert.equal(
      (
        await refusal(
          await request(`/quizzes/${quiz.id}`, 'DELETE', undefined, owner),
          409,
        )
      ).code,
      'QUIZ_LOCKED',
    );
    assert.equal(
      (
        await refusal(
          await request(`/projects/${project.id}`, 'DELETE', undefined, owner),
          409,
        )
      ).code,
      'CONFLICT',
    );
    assert.ok(await db.quiz.findUnique({ where: { id: quiz.id } }));
    const drafts = await data<ProjectDto>(
      await request(
        '/projects',
        'POST',
        { name: 'Drafts only', description: '' },
        owner,
      ),
      201,
    );
    const draftQuiz = (title: string) =>
      request(
        `/projects/${drafts.id}/quizzes`,
        'POST',
        { ...basics, title },
        owner,
      ).then((response) => data<QuizDto>(response, 201));
    const doomed = await draftQuiz('Delete me');
    await data<QuizDto>(
      await request(`/quizzes/${doomed.id}/questions`, 'POST', single, owner),
      201,
    );
    let coverPath: string | undefined;
    if (storage) {
      const png = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9kAAAAASUVORK5CYII=',
        'base64',
      );
      const ticket = await data<UploadDto>(
        await request(
          '/media/upload-request',
          'POST',
          {
            purpose: 'QUIZ_COVER',
            fileName: 'doomed.png',
            mimeType: 'image/png',
            sizeBytes: png.length,
            resource: { quizId: doomed.id },
          },
          owner,
        ),
        201,
      );
      const put = await fetch(ticket.upload.url, {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: png,
      });
      assert.ok(put.ok);
      await data<QuizDto>(
        await request(
          `/quizzes/${doomed.id}`,
          'PATCH',
          { ...basics, title: 'Delete me', coverMediaId: ticket.mediaId },
          owner,
        ),
      );
      coverPath = ticket.upload.path;
    }
    assert.equal(
      (await request(`/quizzes/${doomed.id}`, 'DELETE', undefined, other))
        .status,
      404,
    );
    assert.equal(
      (await request(`/quizzes/${doomed.id}`, 'DELETE', undefined, owner))
        .status,
      204,
    );
    assert.equal(
      (await request(`/quizzes/${doomed.id}`, 'GET', undefined, owner)).status,
      404,
    );
    assert.equal(
      await db.question.count({ where: { quizId: doomed.id } }),
      0,
      'questions are deleted with the quiz',
    );
    assert.equal(
      await db.mediaAsset.count({ where: { quizId: doomed.id } }),
      0,
      'media rows are deleted with the quiz',
    );
    if (storage && coverPath) {
      const stored = await storage.client
        .from(storage.bucket)
        .download(coverPath);
      assert.ok(stored.error, 'the cover file is removed from storage');
    }
    assert.equal(
      (await request(`/quizzes/${doomed.id}`, 'DELETE', undefined, owner))
        .status,
      404,
    );
    const kept = [await draftQuiz('Draft one'), await draftQuiz('Draft two')];
    assert.equal(
      (await request(`/projects/${drafts.id}`, 'DELETE', undefined, other))
        .status,
      404,
    );
    assert.equal(
      (await request(`/projects/${drafts.id}`, 'DELETE', undefined, owner))
        .status,
      204,
    );
    assert.equal(
      (await request(`/projects/${drafts.id}`, 'GET', undefined, owner)).status,
      404,
    );
    assert.equal(
      await db.quiz.count({ where: { id: { in: kept.map((q) => q.id) } } }),
      0,
      'draft quizzes are deleted with their project',
    );
    const rls = await db.$queryRaw<
      Array<{ relrowsecurity: boolean }>
    >`SELECT relrowsecurity FROM pg_class WHERE oid IN ('projects'::regclass, 'quizzes'::regclass, 'questions'::regclass, 'question_options'::regclass, 'media_assets'::regclass)`;
    assert.equal(rls.length, 5);
    assert.ok(rls.every((row) => row.relrowsecurity));
  },
);
