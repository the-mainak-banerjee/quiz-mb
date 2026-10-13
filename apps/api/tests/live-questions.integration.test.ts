import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { createDatabase } from '@quizmb/database';
import {
  ANSWER_STATUS,
  ERROR_CODE,
  LIVE_EVENTS,
  LIVE_SESSION_STATE,
  LIVE_SOCKET_NAMESPACE,
  QUESTION_TYPE,
  type HostLiveSnapshotDto,
  type HostQuestionProgressDto,
  type HostQuizResultsDto,
  type ParticipantDashboardDto,
  type RegistrationDto,
  type ParticipantFinalResultDto,
  type ParticipantQuizResultDto,
  type LeaderboardDto,
  type LiveSessionRefDto,
  type LiveSnapshotDto,
  type ParticipantAnswerDto,
  type ParticipantLiveSnapshotDto,
  type ParticipantStandingDto,
  type QuizDto,
  type SocketAck,
  type SocketTicketDto,
} from '@quizmb/contracts';
import { createApp } from '../src/app.js';
import { MemoryMailbox } from '../src/infrastructure/email.js';
import { signUpVerified } from './auth-helper.js';
import { createLogger } from '../src/infrastructure/logger.js';
import { createRedis } from '../src/infrastructure/redis.js';
import { DomainEvents } from '../src/infrastructure/domain-events.js';
import { AuthRepository } from '../src/modules/auth/repository.js';
import { AuthService } from '../src/modules/auth/service.js';
import { parseAuthEnv } from '../src/modules/auth/config.js';
import { UsersService } from '../src/modules/users/service.js';
import { LiveSessionsRepository } from '../src/modules/live-sessions/repository.js';
import { LiveSessionsService } from '../src/modules/live-sessions/service.js';
import { LiveStore } from '../src/modules/live-sessions/live-store.js';
import { SocketTickets } from '../src/modules/live-sessions/tickets.js';
import { presenceKey } from '../src/modules/live-sessions/constants.js';
import {
  attachLiveRealtime,
  createSocketServer,
} from '../src/modules/live-sessions/realtime.js';

// Short timers keep the scenario fast while leaving room for remote
// database round trips inside each question.
const DURATION = 15;

const quizBasics = {
  description: 'Live question fixture.',
  registrationLimit: 10,
  defaultQuestionDurationSeconds: DURATION,
  allowLateJoin: true,
  coverMediaId: null,
  plannedStartAt: '2030-10-24T19:00:00Z',
};
const questions = [
  {
    type: QUESTION_TYPE.SINGLE_CHOICE,
    text: 'Single choice',
    options: [
      { text: 'Right', isCorrect: true },
      { text: 'Wrong', isCorrect: false },
    ],
  },
  {
    type: QUESTION_TYPE.MULTIPLE_CHOICE,
    text: 'Multiple answer',
    options: [
      { text: 'A', isCorrect: true },
      { text: 'B', isCorrect: false },
      { text: 'C', isCorrect: true },
    ],
  },
  { type: QUESTION_TYPE.DESCRIPTIVE, text: 'Descriptive', options: [] },
].map((item) => ({
  ...item,
  durationOverrideSeconds: null,
  imageMediaId: null,
}));

test(
  'live quiz: questions, scoring, leaderboard, end and final results',
  { skip: !process.env.DATABASE_URL || !process.env.REDIS_URL },
  async (t) => {
    if (process.env.NODE_ENV === 'production')
      throw new Error('Development integration tests only');
    const config = parseAuthEnv(process.env);
    const db = createDatabase(
      config.DATABASE_URL,
      config.DATABASE_SSL_CA_BASE64,
    );
    const mailbox = new MemoryMailbox();
    const redis = createRedis(process.env.REDIS_URL!);
    await redis.connect();
    const events = new DomainEvents();
    const live = new LiveSessionsService(
      new LiveSessionsRepository(db),
      new LiveStore(redis),
      new SocketTickets(config.AUTH_ACCESS_SECRET),
      events,
    );
    const origin = 'http://localhost:3000';
    const logger = createLogger('silent');
    const server = createServer(
      createApp({
        allowedOrigins: [origin],
        logger,
        auth: new AuthService(new AuthRepository(db), config, mailbox),
        users: new UsersService(db),
        database: db,
        live,
        events,
      }),
    );
    const io = createSocketServer(server, [origin]);
    attachLiveRealtime(io, live, logger, events);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

    const roles = ['host', 'a', 'b', 'late'] as const;
    type Role = (typeof roles)[number];
    const emails = roles.map(
      (role) => `liveq-${role}-${randomUUID()}@example.invalid`,
    );
    const sockets: ClientSocket[] = [];
    let liveSessionId = '';

    t.after(async () => {
      for (const socket of sockets) socket.disconnect();
      await io.close();
      const users = await db.user.findMany({
        where: { email: { in: emails } },
        select: { id: true },
      });
      const ids = users.map((user) => user.id);
      await db.quiz.deleteMany({ where: { creatorUserId: { in: ids } } });
      await db.project.deleteMany({ where: { ownerUserId: { in: ids } } });
      await db.user.deleteMany({ where: { id: { in: ids } } });
      await db.$disconnect();
      if (liveSessionId) await redis.del(presenceKey(liveSessionId));
      await redis.quit();
    });

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

    const cookies = {} as Record<Role, string>;
    for (const [index, role] of roles.entries()) {
      const response = await signUpVerified(request, mailbox, {
        name: `Questions ${role}`,
        email: emails[index]!,
        password: 'a strong live question test password',
      });
      assert.equal(response.status, 200);
      cookies[role] = response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
    }

    const project = await data<{ id: string }>(
      await request(
        '/projects',
        'POST',
        { name: 'Questions project', description: 'Integration fixture' },
        cookies.host,
      ),
      201,
    );
    const quiz = await data<QuizDto>(
      await request(
        `/projects/${project.id}/quizzes`,
        'POST',
        { ...quizBasics, title: 'Live questions' },
        cookies.host,
      ),
      201,
    );
    for (const item of questions)
      await data(
        await request(
          `/quizzes/${quiz.id}/questions`,
          'POST',
          item,
          cookies.host,
        ),
        201,
      );
    await data(
      await request(`/quizzes/${quiz.id}/publish`, 'POST', {}, cookies.host),
    );
    for (const role of ['a', 'b', 'late'] as const)
      await data(
        await request(
          `/quizzes/${quiz.id}/register`,
          'POST',
          {},
          cookies[role],
        ),
        201,
      );
    const session = await data<LiveSessionRefDto>(
      await request(
        `/quizzes/${quiz.id}/live-session`,
        'POST',
        {},
        cookies.host,
      ),
      201,
    );
    liveSessionId = session.id;

    const nextEvent = <T>(socket: ClientSocket, event: string) =>
      new Promise<T>((resolve) => socket.once(event, resolve));
    /** Resolves with the first event payload that satisfies `match`. */
    const waitFor = <T>(
      socket: ClientSocket,
      event: string,
      match: (payload: T) => boolean,
    ) =>
      new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`timed out waiting for ${event}`)),
          20_000,
        );
        const listener = (payload: T) => {
          if (!match(payload)) return;
          clearTimeout(timer);
          socket.off(event, listener);
          resolve(payload);
        };
        socket.on(event, listener);
      });
    const emit = <T>(socket: ClientSocket, event: string, payload: object) =>
      socket
        .timeout(10_000)
        .emitWithAck(event, { liveSessionId, ...payload }) as Promise<
        SocketAck<T>
      >;
    const ok = <T>(ack: SocketAck<T>) => {
      assert.ok(ack.ok, JSON.stringify(ack));
      return ack.data;
    };
    const errorCode = <T>(ack: SocketAck<T>) =>
      ack.ok ? 'OK' : ack.error.code;
    const joinAs = async (role: Role) => {
      const { ticket } = await data<SocketTicketDto>(
        await request(
          `/live-sessions/${liveSessionId}/socket-ticket`,
          'POST',
          {},
          cookies[role],
        ),
      );
      const socket = connect(base + LIVE_SOCKET_NAMESPACE, {
        auth: { ticket },
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });
      sockets.push(socket);
      await nextEvent(socket, 'connect');
      const snapshot = ok(
        await emit<LiveSnapshotDto>(socket, LIVE_EVENTS.join, {}),
      );
      return { socket, snapshot };
    };
    const submit = (socket: ClientSocket, payload: object) =>
      emit<ParticipantAnswerDto>(socket, LIVE_EVENTS.answerSubmit, payload);
    const resultFor = (socket: ClientSocket, askedQuestionId: string) =>
      waitFor<ParticipantLiveSnapshotDto>(
        socket,
        LIVE_EVENTS.snapshot,
        (snapshot) =>
          snapshot.state === LIVE_SESSION_STATE.QUESTION_RESULT &&
          snapshot.question?.askedQuestionId === askedQuestionId &&
          'myAnswer' in snapshot,
      );
    const standingFor = (socket: ClientSocket, askedQuestionId: string) =>
      waitFor<ParticipantStandingDto>(
        socket,
        LIVE_EVENTS.standing,
        (standing) => standing.askedQuestionId === askedQuestionId,
      );
    // Host-only progress must never reach a participant socket.
    let leakedProgress = 0;
    const watchForLeaks = (socket: ClientSocket) =>
      socket.on(LIVE_EVENTS.submissions, () => (leakedProgress += 1));

    const host = await joinAs('host');
    const a = await joinAs('a');
    const b = await joinAs('b');
    watchForLeaks(a.socket);
    watchForLeaks(b.socket);
    const hostView = ok(
      await emit<HostLiveSnapshotDto>(host.socket, LIVE_EVENTS.quizStart, {}),
    );
    const [single, multiple, descriptive] = hostView.questions;
    assert.ok(single && multiple && descriptive);
    const optionId = (index: number, text: string) =>
      hostView.questions[index]!.options.find((option) => option.text === text)!
        .id;

    // ---- Only the host asks, and asking needs an idle session.
    assert.equal(
      errorCode(
        await emit(a.socket, LIVE_EVENTS.questionStart, {
          questionId: multiple.id,
        }),
      ),
      ERROR_CODE.FORBIDDEN,
    );

    // ---- Questions can be asked in any order: the second one first.
    const started = waitFor<ParticipantLiveSnapshotDto>(
      a.socket,
      LIVE_EVENTS.snapshot,
      (snapshot) => snapshot.state === LIVE_SESSION_STATE.QUESTION_ACTIVE,
    );
    const afterAsk = ok(
      await emit<HostLiveSnapshotDto>(host.socket, LIVE_EVENTS.questionStart, {
        questionId: multiple.id,
      }),
    );
    assert.equal(afterAsk.state, LIVE_SESSION_STATE.QUESTION_ACTIVE);
    assert.equal(afterAsk.currentQuestion?.questionId, multiple.id);
    assert.equal(afterAsk.currentQuestion?.number, 1);
    const shared = await started;
    const askedFirst = shared.question!.askedQuestionId;
    // Listen for the personal results before anything else can take time.
    const aResultPending = resultFor(a.socket, askedFirst);
    const bResultPending = resultFor(b.socket, askedFirst);
    const aStandingPending = standingFor(a.socket, askedFirst);
    const bStandingPending = standingFor(b.socket, askedFirst);
    assert.equal(shared.question?.number, 1);
    assert.equal(shared.question?.reveal, null);
    assert.equal(
      Date.parse(shared.question!.endsAt) -
        Date.parse(shared.question!.startedAt),
      DURATION * 1000,
    );
    assert.ok(!('myAnswer' in shared), 'broadcasts carry no personal data');
    assert.ok(
      !JSON.stringify(shared).includes('isCorrect'),
      'participants never receive the answer key while it is active',
    );
    assert.ok(
      !JSON.stringify(shared).includes('distribution'),
      'participants never receive the distribution while it is active',
    );

    // ---- A late joiner enters the running question with the same deadline.
    const late = await joinAs('late');
    watchForLeaks(late.socket);
    const lateResultPending = resultFor(late.socket, askedFirst);
    const lateStandingPending = standingFor(late.socket, askedFirst);
    const lateView = late.snapshot as ParticipantLiveSnapshotDto;
    assert.equal(lateView.state, LIVE_SESSION_STATE.QUESTION_ACTIVE);
    assert.equal(lateView.question?.endsAt, shared.question?.endsAt);
    assert.equal(lateView.myAnswer, null);
    assert.equal(lateView.joinedDuringQuestion, true);
    assert.equal(
      errorCode(
        await emit(host.socket, LIVE_EVENTS.questionStart, {
          questionId: single.id,
        }),
      ),
      ERROR_CODE.INVALID_STATE_TRANSITION,
      'only one question is active at a time',
    );

    // ---- Explicit submission, locked once accepted.
    const progress = waitFor<HostQuestionProgressDto>(
      host.socket,
      LIVE_EVENTS.submissions,
      (update) => update.submittedCount === 2,
    );
    const correct = [optionId(1, 'A'), optionId(1, 'C')];
    const accepted = ok(
      await submit(a.socket, {
        askedQuestionId: askedFirst,
        selectedOptionIds: correct,
      }),
    );
    const aSync = ok(
      await emit<ParticipantLiveSnapshotDto>(a.socket, LIVE_EVENTS.sync, {}),
    );
    assert.equal(aSync.myAnswer?.status, ANSWER_STATUS.SUBMITTED);
    assert.equal(aSync.myAnswer?.isCorrect, null);
    assert.equal(
      aSync.myAnswer?.pointsAwarded,
      0,
      'points hidden until the end',
    );
    assert.equal(aSync.question?.reveal, null);
    assert.equal(aSync.myStanding, null);
    assert.equal(aSync.joinedDuringQuestion, false);
    assert.equal(accepted.status, ANSWER_STATUS.SUBMITTED);
    assert.equal(accepted.isCorrect, null, 'correctness hidden until the end');
    assert.equal(
      errorCode(
        await submit(a.socket, {
          askedQuestionId: askedFirst,
          selectedOptionIds: [optionId(1, 'B')],
        }),
      ),
      ERROR_CODE.ALREADY_SUBMITTED,
    );
    assert.equal(
      errorCode(
        await submit(b.socket, {
          askedQuestionId: askedFirst,
          selectedOptionIds: [optionId(0, 'Right')],
        }),
      ),
      ERROR_CODE.INVALID_ANSWER,
      'options from another question are refused',
    );
    assert.equal(
      errorCode(
        await submit(host.socket, {
          askedQuestionId: askedFirst,
          selectedOptionIds: correct,
        }),
      ),
      ERROR_CODE.FORBIDDEN,
    );
    ok(
      await submit(b.socket, {
        askedQuestionId: askedFirst,
        selectedOptionIds: [optionId(1, 'A')],
      }),
    );
    const live1 = await progress;
    assert.equal(live1.distribution[optionId(1, 'A')], 2);
    assert.equal(live1.distribution[optionId(1, 'C')], 1);

    // ---- The timer closes it: each participant gets their own result.
    const [aResult, bResult, lateResult] = await Promise.all([
      aResultPending,
      bResultPending,
      lateResultPending,
    ]);
    assert.deepEqual(
      [...aResult.question!.reveal!.correctOptionIds].sort(),
      [...correct].sort(),
    );
    assert.equal(aResult.question?.reveal?.submittedCount, 2);
    assert.equal(aResult.myAnswer?.isCorrect, true);
    assert.equal(bResult.myAnswer?.isCorrect, false, 'partial is incorrect');
    assert.equal(lateResult.myAnswer?.status, ANSWER_STATUS.NOT_ATTEMPTED);
    assert.ok(!('myStanding' in aResult), 'standing follows the reveal');

    // ---- Scoring: faster correct answers earn more; wrong or missing earn
    // nothing; exact ties share a rank.
    const firstPoints = aResult.myAnswer!.pointsAwarded;
    assert.ok(firstPoints >= 400 && firstPoints <= 1000, String(firstPoints));
    assert.equal(bResult.myAnswer?.pointsAwarded, 0);
    assert.equal(lateResult.myAnswer?.pointsAwarded, 0);
    const [aStanding, bStanding, lateStanding] = await Promise.all([
      aStandingPending,
      bStandingPending,
      lateStandingPending,
    ]);
    assert.deepEqual(
      { ...aStanding, askedQuestionId: undefined },
      {
        askedQuestionId: undefined,
        totalScore: firstPoints,
        rank: 1,
        participantCount: 3,
      },
    );
    assert.equal(bStanding.rank, 2);
    assert.equal(lateStanding.rank, 2, 'equal scores share a rank');
    assert.equal(lateStanding.totalScore, 0);

    // ---- Leaderboard: host-only private view, then shown and hidden.
    assert.equal(
      errorCode(await emit(a.socket, LIVE_EVENTS.leaderboardGet, {})),
      ERROR_CODE.FORBIDDEN,
    );
    const privateBoard = ok(
      await emit<LeaderboardDto>(host.socket, LIVE_EVENTS.leaderboardGet, {}),
    );
    assert.equal(privateBoard.participantCount, 3);
    assert.equal(privateBoard.afterQuestionNumber, 1);
    assert.deepEqual(
      privateBoard.entries.map((entry) => [entry.rank, entry.score]),
      [[1, firstPoints]],
      'only participants who scored are listed (no field of zero ties)',
    );
    assert.equal(privateBoard.entries[0]?.name, 'Questions a');
    const boardOnA = waitFor<ParticipantLiveSnapshotDto>(
      a.socket,
      LIVE_EVENTS.snapshot,
      (snapshot) => snapshot.state === LIVE_SESSION_STATE.LEADERBOARD,
    );
    const shownHost = ok(
      await emit<HostLiveSnapshotDto>(
        host.socket,
        LIVE_EVENTS.leaderboardShow,
        {},
      ),
    );
    assert.equal(shownHost.state, LIVE_SESSION_STATE.LEADERBOARD);
    assert.equal(shownHost.leaderboard?.entries.length, 1);
    assert.equal(shownHost.leaderboard?.participantCount, 3);
    const aBoard = await boardOnA;
    assert.equal(aBoard.leaderboard?.entries[0]?.name, 'Questions a');
    assert.equal(
      aBoard.question?.askedQuestionId,
      askedFirst,
      'the latest result stays underneath the leaderboard',
    );
    assert.equal(
      errorCode(await emit(host.socket, LIVE_EVENTS.leaderboardShow, {})),
      ERROR_CODE.INVALID_STATE_TRANSITION,
    );
    const lateDuringBoard = ok(
      await emit<ParticipantLiveSnapshotDto>(late.socket, LIVE_EVENTS.sync, {}),
    );
    assert.equal(lateDuringBoard.state, LIVE_SESSION_STATE.LEADERBOARD);
    assert.equal(
      lateDuringBoard.myStanding?.rank,
      2,
      'personal rank stays available',
    );
    const hiddenOnA = waitFor<ParticipantLiveSnapshotDto>(
      a.socket,
      LIVE_EVENTS.snapshot,
      (snapshot) => snapshot.state === LIVE_SESSION_STATE.QUESTION_RESULT,
    );
    ok(await emit(host.socket, LIVE_EVENTS.leaderboardHide, {}));
    const backToResult = await hiddenOnA;
    assert.equal(backToResult.leaderboard, null);
    assert.equal(backToResult.question?.askedQuestionId, askedFirst);
    // Shown again: asking the next question from the leaderboard hides it.
    ok(await emit(host.socket, LIVE_EVENTS.leaderboardShow, {}));
    assert.equal(
      errorCode(
        await submit(late.socket, {
          askedQuestionId: askedFirst,
          selectedOptionIds: correct,
        }),
      ),
      ERROR_CODE.SUBMISSION_CLOSED,
    );
    // Another session's question reveals nothing about its existence or
    // status: it is simply not active there.
    await assert.rejects(
      live.submit(randomUUID(), 'no-socket', {
        liveSessionId: randomUUID(),
        askedQuestionId: askedFirst,
        selectedOptionIds: correct,
      }),
      (error: { code?: string }) =>
        error.code === ERROR_CODE.QUESTION_NOT_ACTIVE,
    );
    assert.equal(
      errorCode(
        await emit(host.socket, LIVE_EVENTS.questionStart, {
          questionId: multiple.id,
        }),
      ),
      ERROR_CODE.QUESTION_ALREADY_ASKED,
    );

    // ---- Recovery path: with its timer gone, the next interaction closes
    // an overdue question.
    const descriptiveHost = ok(
      await emit<HostLiveSnapshotDto>(host.socket, LIVE_EVENTS.questionStart, {
        questionId: descriptive.id,
      }),
    );
    const askedSecond = descriptiveHost.currentQuestion!.askedQuestionId;
    assert.equal(descriptiveHost.leaderboard, null);
    assert.equal(
      errorCode(await emit(host.socket, LIVE_EVENTS.leaderboardShow, {})),
      ERROR_CODE.INVALID_STATE_TRANSITION,
      'never during a question',
    );
    const timing = live as unknown as {
      clearTimer(id: string, askedQuestionId?: string): void;
      timers: Map<string, { askedQuestionId: string }>;
    };
    // A late close of the previous question must not disarm this one.
    timing.clearTimer(liveSessionId, askedFirst);
    assert.equal(
      timing.timers.get(liveSessionId)?.askedQuestionId,
      askedSecond,
      'the active question keeps its close timer',
    );
    timing.clearTimer(liveSessionId);
    const responses = waitFor<HostQuestionProgressDto>(
      host.socket,
      LIVE_EVENTS.submissions,
      (update) => update.responses.length === 1,
    );
    ok(
      await submit(a.socket, {
        askedQuestionId: askedSecond,
        answerText: 'Because tokens scale.',
      }),
    );
    assert.equal((await responses).responses[0]?.text, 'Because tokens scale.');
    await new Promise((resolve) => setTimeout(resolve, DURATION * 1000 + 300));
    const aClosed = resultFor(a.socket, askedSecond);
    const aSecondStanding = standingFor(a.socket, askedSecond);
    const bSynced = ok(
      await emit<ParticipantLiveSnapshotDto>(b.socket, LIVE_EVENTS.sync, {}),
    );
    assert.equal(bSynced.state, LIVE_SESSION_STATE.QUESTION_RESULT);
    assert.equal(bSynced.myAnswer?.status, ANSWER_STATUS.NOT_ATTEMPTED);
    const aDescriptive = await aClosed;
    assert.equal(aDescriptive.myAnswer?.answerText, 'Because tokens scale.');
    assert.equal(aDescriptive.myAnswer?.isCorrect, null);
    assert.deepEqual(aDescriptive.question?.reveal?.correctOptionIds, []);
    assert.equal(aDescriptive.myAnswer?.pointsAwarded, 0);
    const afterDescriptive = await aSecondStanding;
    assert.equal(afterDescriptive.totalScore, firstPoints, 'not scored');
    assert.equal(afterDescriptive.rank, 1);
    assert.equal(bSynced.myStanding?.totalScore, 0);
    assert.equal(bSynced.myStanding?.rank, 2);
    assert.equal(leakedProgress, 0, 'participants never get host progress');

    // ---- Ending the quiz mid-question closes it; later answers are refused.
    const lastAsk = ok(
      await emit<HostLiveSnapshotDto>(host.socket, LIVE_EVENTS.questionStart, {
        questionId: single.id,
      }),
    );
    const askedThird = lastAsk.currentQuestion!.askedQuestionId;
    assert.equal(lastAsk.currentQuestion?.number, 3);
    const finalFor = (socket: ClientSocket) =>
      nextEvent<ParticipantFinalResultDto>(socket, LIVE_EVENTS.quizEnded);
    const finals = Promise.all(
      [a, b, late].map(({ socket }) => finalFor(socket)),
    );
    const endedHost = ok(
      await emit<HostLiveSnapshotDto>(host.socket, LIVE_EVENTS.quizEnd, {}),
    );
    assert.equal(
      errorCode(
        await submit(b.socket, {
          askedQuestionId: askedThird,
          selectedOptionIds: [optionId(0, 'Right')],
        }),
      ),
      ERROR_CODE.SUBMISSION_CLOSED,
    );

    // ---- Final results: asked questions only; descriptive not counted.
    // Scored questions asked: the multiple-answer one and the single choice
    // that was ended early (nobody answered it).
    const [aFinal, bFinal, lateFinal] = await finals;
    assert.deepEqual(aFinal, {
      totalScore: firstPoints,
      rank: 1,
      participantCount: 3,
      correctCount: 1,
      incorrectCount: 0,
      notAttemptedCount: 1,
    });
    assert.deepEqual(bFinal, {
      totalScore: 0,
      rank: 2,
      participantCount: 3,
      correctCount: 0,
      incorrectCount: 1,
      notAttemptedCount: 1,
    });
    assert.deepEqual(lateFinal, {
      totalScore: 0,
      rank: 2,
      participantCount: 3,
      correctCount: 0,
      incorrectCount: 0,
      notAttemptedCount: 2,
    });
    assert.equal(endedHost.state, LIVE_SESSION_STATE.COMPLETED);
    assert.equal(endedHost.final?.summary.participantCount, 3);
    assert.equal(endedHost.final?.summary.askedQuestionCount, 3);
    assert.equal(endedHost.final?.summary.scoredQuestionCount, 2);
    assert.equal(endedHost.final?.summary.quizQuestionCount, 3);
    assert.equal(
      endedHost.final?.summary.averageScore,
      Math.round(firstPoints / 3),
    );
    assert.equal(endedHost.final?.leaderboard.entries[0]?.correctCount, 1);
    assert.equal(endedHost.final?.leaderboardShown, false);
    assert.deepEqual(
      endedHost.final?.leaderboard.entries.map((entry) => entry.name),
      ['Questions a'],
      'only scorers are listed',
    );
    ok(await emit(host.socket, LIVE_EVENTS.quizEnd, {}));
    assert.equal(
      await db.quizResult.count({ where: { liveSessionId } }),
      3,
      'ending again writes no new results',
    );

    // ---- The final leaderboard is host-controlled.
    assert.equal(
      errorCode(await emit(a.socket, LIVE_EVENTS.finalLeaderboardShow, {})),
      ERROR_CODE.FORBIDDEN,
    );
    const finalOnA = waitFor<ParticipantLiveSnapshotDto>(
      a.socket,
      LIVE_EVENTS.snapshot,
      (snapshot) =>
        snapshot.state === LIVE_SESSION_STATE.COMPLETED &&
        snapshot.leaderboard !== null,
    );
    const revealed = ok(
      await emit<HostLiveSnapshotDto>(
        host.socket,
        LIVE_EVENTS.finalLeaderboardShow,
        {},
      ),
    );
    assert.equal(revealed.final?.leaderboardShown, true);
    assert.equal((await finalOnA).leaderboard?.entries[0]?.name, 'Questions a');

    // ---- No rejoining once the quiz has ended.
    const { ticket: afterTicket } = await data<SocketTicketDto>(
      await request(
        `/live-sessions/${liveSessionId}/socket-ticket`,
        'POST',
        {},
        cookies.b,
      ),
    );
    const afterSocket = connect(base + LIVE_SOCKET_NAMESPACE, {
      auth: { ticket: afterTicket },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
    });
    sockets.push(afterSocket);
    await nextEvent(afterSocket, 'connect');
    assert.equal(
      errorCode(await emit(afterSocket, LIVE_EVENTS.join, {})),
      ERROR_CODE.QUIZ_COMPLETED,
    );

    // ---- Closing the room: host-only; everyone else is told and
    // disconnected, the closing host keeps its socket.
    assert.equal(
      errorCode(await emit(a.socket, LIVE_EVENTS.sessionClose, {})),
      ERROR_CODE.FORBIDDEN,
    );
    const closedOnA = nextEvent<{ code: string }>(
      a.socket,
      LIVE_EVENTS.removed,
    );
    const aGone = nextEvent(a.socket, 'disconnect');
    ok(await emit(host.socket, LIVE_EVENTS.sessionClose, {}));
    assert.equal((await closedOnA).code, ERROR_CODE.SESSION_CLOSED);
    await aGone;
    assert.equal(host.socket.connected, true);

    // ---- Results pages and history.
    const results = await data<HostQuizResultsDto>(
      await request(
        `/quizzes/${quiz.id}/results`,
        'GET',
        undefined,
        cookies.host,
      ),
    );
    assert.deepEqual(
      results.entries.map((entry) => [entry.rank, entry.name]),
      [
        [1, 'Questions a'],
        [2, 'Questions b'],
        [2, 'Questions late'],
      ],
    );
    assert.equal(results.nextOffset, null);
    assert.equal(results.summary.scoredQuestionCount, 2);
    assert.equal(
      (
        await request(
          `/quizzes/${quiz.id}/results`,
          'GET',
          undefined,
          cookies.a,
        )
      ).status,
      404,
      'only the host sees full results',
    );
    const mine = await data<ParticipantQuizResultDto>(
      await request(
        `/live-sessions/${liveSessionId}/my-result`,
        'GET',
        undefined,
        cookies.late,
      ),
    );
    assert.equal(mine.quiz.id, quiz.id);
    assert.ok(mine.startedAt && mine.completedAt);
    assert.ok(mine.startedAt <= mine.completedAt, 'started before it ended');
    assert.equal(mine.result?.notAttemptedCount, 2);
    assert.equal(
      (
        await request(
          `/live-sessions/${liveSessionId}/my-result`,
          'GET',
          undefined,
          cookies.host,
        )
      ).status,
      404,
    );
    const registration = await data<RegistrationDto>(
      await request(
        `/quizzes/${quiz.id}/registration`,
        'GET',
        undefined,
        cookies.a,
      ),
    );
    assert.equal(
      registration.completedLiveSessionId,
      liveSessionId,
      'a registered participant can open their result from the quiz page',
    );
    const dashboard = await data<ParticipantDashboardDto>(
      await request('/dashboard/participant', 'GET', undefined, cookies.a),
    );
    const item = dashboard.history.find(
      (entry) => entry.liveSessionId === liveSessionId,
    );
    assert.equal(item?.quiz.id, quiz.id);
    assert.equal(item?.result?.totalScore, firstPoints);
    assert.equal(item?.result?.rank, 1);

    // ---- Only presented questions exist, in live order.
    const asked = await db.askedQuestion.findMany({
      where: { liveSessionId },
      orderBy: { sequenceNumber: 'asc' },
      select: { questionId: true, status: true },
    });
    assert.deepEqual(
      asked.map((item) => item.questionId),
      [multiple.id, descriptive.id, single.id],
    );
    assert.ok(asked.every((item) => item.status === 'COMPLETED'));
    assert.equal(
      await db.answerSubmission.count({
        where: { askedQuestion: { liveSessionId } },
      }),
      3,
      'missed questions are not stored as rows',
    );
  },
);
