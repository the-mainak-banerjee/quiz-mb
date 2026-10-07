import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { createDatabase } from '@quizmb/database';
import {
  ACCOUNT_LIMITS,
  AUTHORING_LIMITS,
  ERROR_CODE,
  MEDIA_LIMITS,
  type ProjectDto,
  type QuizCreatedDto,
  type QuizDto,
  type UploadDto,
} from '@quizmb/contracts';
import { createApp } from '../src/app.js';
import { MemoryMailbox } from '../src/infrastructure/email.js';
import { createLogger } from '../src/infrastructure/logger.js';
import { AuthRepository } from '../src/modules/auth/repository.js';
import { AuthService } from '../src/modules/auth/service.js';
import { parseAuthEnv } from '../src/modules/auth/config.js';
import { createStorage } from '../src/modules/media/storage.js';
import {
  MediaService,
  PENDING_UPLOAD_TTL_MS,
  PLATFORM_STORAGE,
} from '../src/modules/media/service.js';
import { UsersService } from '../src/modules/users/service.js';
import { signUpVerified } from './auth-helper.js';

// Security design 1.5: quiz creation allowance, the question limit, the
// media quota (with simultaneous reservations), the daily upload allowance,
// the platform storage pause, detached images and abandoned uploads.
test(
  'quiz creation, question and media limits',
  { skip: !process.env.DATABASE_URL },
  async (t) => {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Development integration tests only');
    const config = parseAuthEnv(process.env);
    const db = createDatabase(
      config.DATABASE_URL,
      config.DATABASE_SSL_CA_BASE64,
    );
    const storage = createStorage(process.env);
    const mailbox = new MemoryMailbox();
    const origin = 'http://localhost:3000';
    const server = createApp({
      allowedOrigins: [origin],
      logger: createLogger('silent'),
      auth: new AuthService(new AuthRepository(db), config, mailbox),
      users: new UsersService(db),
      database: db,
      ...(storage ? { storage } : {}),
    }).listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const run = randomUUID();
    const emailOf = (who: string) => `limits-${who}-${run}@example.invalid`;
    const mine = { email: { endsWith: `-${run}@example.invalid` } };
    t.after(async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      const assets = await db.mediaAsset.findMany({
        where: { owner: mine, status: { not: 'DELETED' } },
      });
      if (storage && assets.length)
        await storage.client
          .from(storage.bucket)
          .remove(assets.map((asset) => asset.objectPath));
      await db.quiz.deleteMany({ where: { creator: mine } });
      await db.mediaAsset.deleteMany({ where: { owner: mine } });
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
    const json = async <T>(response: Response, status: number) => {
      const body = (await response.json()) as {
        data: T;
        error?: { code: string; message: string };
      };
      assert.equal(response.status, status, JSON.stringify(body));
      return body;
    };
    const signUp = async (who: string) => {
      const response = await signUpVerified(request, mailbox, {
        name: `Limits ${who}`,
        email: emailOf(who),
        password: 'a sufficiently long limits password',
      });
      assert.equal(response.status, 200);
      const cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
      const user = await db.user.findUniqueOrThrow({
        where: { email: emailOf(who) },
      });
      const project = (
        await json<ProjectDto>(
          await request(
            '/projects',
            'POST',
            { name: `Limits ${who}`, description: '' },
            cookie,
          ),
          201,
        )
      ).data;
      return { cookie, userId: user.id, projectId: project.id };
    };
    const basics = {
      title: 'Limits quiz',
      description: '',
      registrationLimit: 10,
      defaultQuestionDurationSeconds: 20,
      allowLateJoin: true,
      coverMediaId: null,
      plannedStartAt: '2030-01-01T10:00:00Z',
    };
    const createQuiz = (
      who: { cookie: string; projectId: string },
      extra = {},
    ) =>
      request(
        `/projects/${who.projectId}/quizzes`,
        'POST',
        { ...basics, ...extra },
        who.cookie,
      );

    // ---- 100 quiz creations per rolling 24 hours; deleting never restores.
    const creator = await signUp('creator');
    await db.usageEvent.createMany({
      data: Array.from(
        { length: ACCOUNT_LIMITS.quizCreationsPerDay - 1 },
        (_, i) => ({
          userId: creator.userId,
          kind: 'QUIZ_CREATED' as const,
          createdAt: new Date(Date.now() - (i + 1) * 60_000),
        }),
      ),
    });
    const last = await json<QuizDto>(await createQuiz(creator), 201);
    const overDaily = await json(await createQuiz(creator), 429);
    assert.equal(overDaily.error?.code, ERROR_CODE.LIMIT_REACHED);
    assert.match(overDaily.error!.message, /up to 100 quizzes a day/);
    assert.equal(
      (
        await request(
          `/quizzes/${last.data.id}`,
          'DELETE',
          undefined,
          creator.cookie,
        )
      ).status,
      204,
    );
    assert.equal(
      (await createQuiz(creator)).status,
      429,
      'deleting a quiz does not give the creation back',
    );

    // ---- 25 questions per quiz.
    const author = await signUp('author');
    const quiz = (await json<QuizDto>(await createQuiz(author), 201)).data;
    const question = {
      type: 'SINGLE_CHOICE',
      text: 'Pick one',
      imageMediaId: null,
      durationOverrideSeconds: null,
      options: [
        { text: 'A', isCorrect: true },
        { text: 'B', isCorrect: false },
      ],
    };
    for (let i = 0; i < AUTHORING_LIMITS.questions; i++)
      await json(
        await request(
          `/quizzes/${quiz.id}/questions`,
          'POST',
          question,
          author.cookie,
        ),
        201,
      );
    const tooMany = await json(
      await request(
        `/quizzes/${quiz.id}/questions`,
        'POST',
        question,
        author.cookie,
      ),
      422,
    );
    assert.equal(tooMany.error?.code, ERROR_CODE.VALIDATION_ERROR);

    if (!storage) return;
    const png = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aF9kAAAAASUVORK5CYII=',
      'base64',
    );
    const uploadRequest = (
      who: { cookie: string },
      quizId: string,
      sizeBytes = png.length,
    ) =>
      request(
        '/media/upload-request',
        'POST',
        {
          purpose: 'QUIZ_COVER',
          fileName: 'cover.png',
          mimeType: 'image/png',
          sizeBytes,
          resource: { quizId },
        },
        who.cookie,
      );
    /** Stored-image rows that only count toward the quota (no files). */
    const occupy = (userId: string, quizId: string, bytes: number[]) =>
      db.mediaAsset.createMany({
        data: bytes.map((sizeBytes) => ({
          ownerUserId: userId,
          quizId,
          purpose: 'QUIZ_COVER' as const,
          status: 'READY' as const,
          bucket: storage.bucket,
          objectPath: `limits-test/${run}/${randomUUID()}.png`,
          fileName: 'filler.png',
          mimeType: 'image/png',
          sizeBytes,
        })),
      });

    // ---- The upload limit is the optimized size.
    assert.equal(
      (await uploadRequest(author, quiz.id, MEDIA_LIMITS.maxBytes + 1)).status,
      422,
      'more than 250 KB is never authorized',
    );

    // ---- 5 MB per account, reserved atomically before a ticket.
    const full = await signUp('full');
    const fullQuiz = (await json<QuizDto>(await createQuiz(full), 201)).data;
    const nearlyFull = ACCOUNT_LIMITS.mediaBytes - 300 * 1024;
    await occupy(full.userId, fullQuiz.id, [nearlyFull]);
    const burst = await Promise.all(
      [0, 1, 2].map(() => uploadRequest(full, fullQuiz.id, 250 * 1024)),
    );
    assert.deepEqual(
      burst.map((response) => response.status).sort(),
      [201, 409, 409],
      'only one reservation fits',
    );
    const refused = burst.find((response) => response.status === 409)!;
    const refusedBody = (await refused.json()) as {
      error: { code: string; message: string };
    };
    assert.equal(refusedBody.error.code, ERROR_CODE.LIMIT_REACHED);
    assert.match(refusedBody.error.message, /of 5 MB/);

    // ---- A quiz is still created when its cover does not fit.
    const withCover = await json<QuizCreatedDto>(
      await createQuiz(full, {
        cover: {
          fileName: 'cover.png',
          mimeType: 'image/png',
          sizeBytes: 200 * 1024,
        },
      }),
      201,
    );
    assert.equal(withCover.data.coverUpload, null);
    assert.match(withCover.data.coverRefusal ?? '', /of 5 MB/);

    // ---- 50 successful uploads per rolling 24 hours.
    const busy = await signUp('busy');
    const busyQuiz = (await json<QuizDto>(await createQuiz(busy), 201)).data;
    await db.usageEvent.createMany({
      data: Array.from({ length: ACCOUNT_LIMITS.uploadsPerDay }, (_, i) => ({
        userId: busy.userId,
        kind: 'MEDIA_UPLOADED' as const,
        createdAt: new Date(Date.now() - (i + 1) * 60_000),
      })),
    });
    const daily = await json(await uploadRequest(busy, busyQuiz.id), 429);
    assert.equal(daily.error?.code, ERROR_CODE.LIMIT_REACHED);

    // ---- A detached image is deleted at once, freeing its quota.
    const editor = await signUp('editor');
    const editorQuiz = (await json<QuizDto>(await createQuiz(editor), 201))
      .data;
    const ticket = (
      await json<UploadDto>(await uploadRequest(editor, editorQuiz.id), 201)
    ).data;
    assert.ok(
      (
        await fetch(ticket.upload.url, {
          method: 'PUT',
          headers: { 'Content-Type': 'image/png' },
          body: png,
        })
      ).ok,
    );
    await json(
      await request(
        `/quizzes/${editorQuiz.id}`,
        'PATCH',
        { ...basics, coverMediaId: ticket.mediaId },
        editor.cookie,
      ),
      200,
    );
    assert.equal(
      (await db.mediaAsset.findUniqueOrThrow({ where: { id: ticket.mediaId } }))
        .status,
      'READY',
    );
    assert.equal(
      await db.usageEvent.count({
        where: { userId: editor.userId, kind: 'MEDIA_UPLOADED' },
      }),
      1,
      'a verified upload counts toward the daily allowance',
    );
    await json(
      await request(
        `/quizzes/${editorQuiz.id}`,
        'PATCH',
        basics,
        editor.cookie,
      ),
      200,
    );
    assert.equal(
      (await db.mediaAsset.findUniqueOrThrow({ where: { id: ticket.mediaId } }))
        .status,
      'DELETED',
      'removing the cover deletes the image',
    );
    const gone = await storage.client
      .from(storage.bucket)
      .download(ticket.upload.path);
    assert.ok(gone.error, 'and its file');

    // ---- Abandoned uploads are deleted after 24 hours.
    const maintenance = new MediaService(db, storage);
    const abandoned = (
      await json<UploadDto>(await uploadRequest(editor, editorQuiz.id), 201)
    ).data;
    await db.mediaAsset.update({
      where: { id: abandoned.mediaId },
      data: {
        createdAt: new Date(Date.now() - PENDING_UPLOAD_TTL_MS - 60_000),
      },
    });
    await maintenance.cleanUp();
    assert.equal(
      (
        await db.mediaAsset.findUniqueOrThrow({
          where: { id: abandoned.mediaId },
        })
      ).status,
      'DELETED',
    );

    // ---- The platform pauses new uploads at 800 MB (pending included).
    const filler = await signUp('filler');
    const fillerQuiz = (await json<QuizDto>(await createQuiz(filler), 201))
      .data;
    const platform =
      (
        await db.mediaAsset.aggregate({
          where: { status: { not: 'DELETED' } },
          _sum: { sizeBytes: true },
        })
      )._sum.sizeBytes ?? 0;
    const chunk = 10 * 1024 * 1024;
    const needed = Math.max(0, PLATFORM_STORAGE.pauseBytes - platform);
    await occupy(
      filler.userId,
      fillerQuiz.id,
      Array.from({ length: Math.ceil(needed / chunk) }, () => chunk),
    );
    const paused = await json(await uploadRequest(editor, editorQuiz.id), 503);
    assert.equal(paused.error?.code, ERROR_CODE.STORAGE_UNAVAILABLE);
    // Release the platform for other tests straight away.
    await db.mediaAsset.deleteMany({ where: { ownerUserId: filler.userId } });
  },
);
