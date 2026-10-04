import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket as ClientSocket } from 'socket.io-client';
import { createDatabase } from '@quizmb/database';
import {
  LIVE_EVENTS,
  LIVE_SOCKET_NAMESPACE,
  QUESTION_TYPE,
  type LiveSessionRefDto,
  type LiveSnapshotDto,
  type QuizDto,
  type SocketAck,
  type SocketTicketDto,
} from '@quizmb/contracts';
import { createApp } from '../src/app.js';
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

export const liveSkip = !process.env.DATABASE_URL || !process.env.REDIS_URL;

/** A single-choice question with one right and one wrong option. */
export const singleChoice = (text: string, durationOverrideSeconds = 15) => ({
  type: QUESTION_TYPE.SINGLE_CHOICE,
  text,
  durationOverrideSeconds,
  imageMediaId: null,
  options: [
    { text: 'Right', isCorrect: true },
    { text: 'Wrong', isCorrect: false },
  ],
});

type Question = ReturnType<typeof singleChoice>;

/**
 * A real API (REST + Socket.IO) on a random port against the development
 * database and Redis, with signed-up users named by role. Everything it
 * creates is removed after the test.
 */
export async function startLiveHarness<Role extends string>(
  t: TestContext,
  roles: readonly Role[],
) {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Development integration tests only');
  const config = parseAuthEnv(process.env);
  const db = createDatabase(config.DATABASE_URL, config.DATABASE_SSL_CA_BASE64);
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
      auth: new AuthService(new AuthRepository(db), config),
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

  const emails = roles.map(
    (role) => `live-edge-${role}-${randomUUID()}@example.invalid`,
  );
  const sockets: ClientSocket[] = [];
  const sessionIds: string[] = [];

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
    for (const id of sessionIds) await redis.del(presenceKey(id));
    await redis.quit();
  });

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

  const cookies = {} as Record<Role, string>;
  const userIds = {} as Record<Role, string>;
  for (const [index, role] of roles.entries()) {
    const response = await request('/auth/signup', 'POST', {
      name: `Edge ${role}`,
      email: emails[index],
      password: 'a strong live edge case test password',
    });
    assert.equal(response.status, 201);
    cookies[role] = response.headers
      .getSetCookie()
      .map((value) => value.split(';')[0])
      .join('; ');
    userIds[role] = (
      await db.user.findUniqueOrThrow({ where: { email: emails[index]! } })
    ).id;
  }
  const host = roles[0]!;
  const project = await data<{ id: string }>(
    await request(
      '/projects',
      'POST',
      { name: 'Live edge cases', description: 'Integration fixture' },
      cookies[host],
    ),
    201,
  );

  /**
   * Creates and publishes a quiz owned by the first role, registers the
   * given participants and opens its lobby.
   */
  async function openQuiz(
    title: string,
    participants: readonly Role[],
    questions: readonly Question[] = [singleChoice('Only question')],
  ) {
    const quiz = await data<QuizDto>(
      await request(
        `/projects/${project.id}/quizzes`,
        'POST',
        {
          title,
          description: 'Live edge case fixture.',
          registrationLimit: 10,
          defaultQuestionDurationSeconds: 15,
          allowLateJoin: true,
          coverMediaId: null,
          plannedStartAt: '2030-10-24T19:00:00Z',
        },
        cookies[host],
      ),
      201,
    );
    for (const question of questions)
      await data(
        await request(
          `/quizzes/${quiz.id}/questions`,
          'POST',
          question,
          cookies[host],
        ),
        201,
      );
    await data(
      await request(`/quizzes/${quiz.id}/publish`, 'POST', {}, cookies[host]),
    );
    for (const role of participants)
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
        cookies[host],
      ),
      201,
    );
    sessionIds.push(session.id);
    return { quiz, liveSessionId: session.id };
  }

  const nextEvent = <T>(socket: ClientSocket, event: string) =>
    new Promise<T>((resolve) => socket.once(event, resolve));
  /** Resolves with the first event payload that satisfies `match`. */
  const waitFor = <T>(
    socket: ClientSocket,
    event: string,
    match: (payload: T) => boolean = () => true,
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
  const ok = <T>(ack: SocketAck<T>) => {
    assert.ok(ack.ok, JSON.stringify(ack));
    return ack.data;
  };
  const errorCode = <T>(ack: SocketAck<T>) => (ack.ok ? 'OK' : ack.error.code);

  /** Connects a socket for `role` and joins the session. */
  async function joinAs(liveSessionId: string, role: Role) {
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
    const emit = <T>(event: string, payload: object = {}) =>
      socket
        .timeout(10_000)
        .emitWithAck(event, { liveSessionId, ...payload }) as Promise<
        SocketAck<T>
      >;
    const snapshot = ok(await emit<LiveSnapshotDto>(LIVE_EVENTS.join));
    return { socket, snapshot, emit };
  }

  return {
    db,
    live,
    request,
    data,
    cookies,
    userIds,
    openQuiz,
    joinAs,
    nextEvent,
    waitFor,
    ok,
    errorCode,
  };
}
