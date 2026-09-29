import { test } from 'node:test';
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
  type HostLiveSnapshotDto,
  type LivePresenceDto,
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
import {
  attachLiveRealtime,
  createSocketServer,
} from '../src/modules/live-sessions/realtime.js';

const quizBasics = {
  description: 'Live session fixture.',
  registrationLimit: 10,
  defaultQuestionDurationSeconds: 20,
  allowLateJoin: true,
  coverMediaId: null,
  plannedStartAt: '2030-10-24T19:00:00Z',
};

const question = {
  type: 'SINGLE_CHOICE',
  text: 'Which value is correct?',
  durationOverrideSeconds: null,
  imageMediaId: null,
  options: [
    { text: 'A', isCorrect: true },
    { text: 'B', isCorrect: false },
  ],
};

test(
  'live session lobby, start, presence, device replacement, late join and end',
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
    const live = new LiveSessionsService(
      new LiveSessionsRepository(db),
      new LiveStore(redis),
      new SocketTickets(config.AUTH_ACCESS_SECRET),
    );
    const origin = 'http://localhost:3000';
    const logger = createLogger('silent');
    const events = new DomainEvents();
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

    const roles = ['host', 'a', 'b', 'c', 'late', 'outsider', 'drop'] as const;
    const emails = roles.map(
      (role) => `live-${role}-${randomUUID()}@example.invalid`,
    );
    const sockets: ClientSocket[] = [];
    const sessionIds = new Set<string>();

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
      for (const id of sessionIds) await redis.del(`lq:${id}:presence`);
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
    const failure = async (response: Response) => {
      const body = (await response.json()) as {
        error: { code: string; details?: Record<string, string> };
      };
      return { status: response.status, ...body.error };
    };

    const cookies: Record<(typeof roles)[number], string> = {} as never;
    for (const [index, role] of roles.entries()) {
      const response = await request('/auth/signup', 'POST', {
        name: `Live ${role}`,
        email: emails[index],
        password: 'a strong live session test password',
      });
      assert.equal(response.status, 201);
      cookies[role] = response.headers
        .getSetCookie()
        .map((value) => value.split(';')[0])
        .join('; ');
    }
    const hostId = (
      await db.user.findUniqueOrThrow({ where: { email: emails[0]! } })
    ).id;

    const project = await data<{ id: string }>(
      await request(
        '/projects',
        'POST',
        { name: 'Live project', description: 'Integration fixture' },
        cookies.host,
      ),
      201,
    );
    async function publishedQuiz(title: string) {
      const quiz = await data<QuizDto>(
        await request(
          `/projects/${project.id}/quizzes`,
          'POST',
          { ...quizBasics, title },
          cookies.host,
        ),
        201,
      );
      await data(
        await request(
          `/quizzes/${quiz.id}/questions`,
          'POST',
          question,
          cookies.host,
        ),
        201,
      );
      return data<QuizDto>(
        await request(`/quizzes/${quiz.id}/publish`, 'POST', {}, cookies.host),
      );
    }
    const quiz = await publishedQuiz('Live quiz one');
    const other = await publishedQuiz('Live quiz two');
    const third = await publishedQuiz('Live quiz three');
    const draft = await data<QuizDto>(
      await request(
        `/projects/${project.id}/quizzes`,
        'POST',
        { ...quizBasics, title: 'Draft quiz' },
        cookies.host,
      ),
      201,
    );

    for (const role of ['a', 'b', 'c'] as const)
      await data(
        await request(
          `/quizzes/${quiz.id}/register`,
          'POST',
          {},
          cookies[role],
        ),
        201,
      );

    // ---- Opening lobbies: ownership, lifecycle and one live quiz per host.
    assert.equal(
      (
        await failure(
          await request(
            `/quizzes/${quiz.id}/live-session`,
            'POST',
            {},
            cookies.a,
          ),
        )
      ).status,
      404,
    );
    assert.equal(
      (
        await failure(
          await request(
            `/quizzes/${draft.id}/live-session`,
            'POST',
            {},
            cookies.host,
          ),
        )
      ).code,
      'QUIZ_NOT_OPEN',
    );
    // Concurrent opens across two quizzes (QA scenario: 8 simultaneous
    // requests). Exactly one session exists; duplicates for the winning quiz
    // are idempotent 201s and every request for the other quiz is a 409.
    const raceTargets = Array.from({ length: 8 }, (_, index) =>
      index % 2 ? other.id : quiz.id,
    );
    const race = await Promise.all(
      raceTargets.map(async (id) => {
        const response = await request(
          `/quizzes/${id}/live-session`,
          'POST',
          {},
          cookies.host,
        );
        return {
          id,
          status: response.status,
          body: (await response.json()) as {
            data?: LiveSessionRefDto;
            error?: { code: string; details?: Record<string, string> };
          },
        };
      }),
    );
    for (const result of race)
      assert.ok(
        result.status === 201 || result.status === 409,
        JSON.stringify(result),
      );
    const created = race.filter((result) => result.status === 201);
    const winner = created[0]!.body.data!;
    sessionIds.add(winner.id);
    for (const result of created) {
      assert.equal(result.body.data!.id, winner.id);
      assert.equal(result.id, winner.quizId);
    }
    for (const result of race.filter((item) => item.status === 409)) {
      assert.notEqual(result.id, winner.quizId);
      assert.equal(result.body.error!.code, 'ACTIVE_SESSION_EXISTS');
      assert.equal(result.body.error!.details?.liveSessionId, winner.id);
    }
    assert.equal(
      await db.liveQuizSession.count({
        where: { hostUserId: hostId, state: { not: 'COMPLETED' } },
      }),
      1,
    );
    // Reset so the scenario continues on `quiz`.
    if (winner.quizId !== quiz.id) {
      await live.end(winner.id, hostId);
    }
    const session = await data<LiveSessionRefDto>(
      await request(
        `/quizzes/${quiz.id}/live-session`,
        'POST',
        {},
        cookies.host,
      ),
      201,
    );
    sessionIds.add(session.id);
    assert.equal(session.state, 'LOBBY');
    assert.equal(session.role, 'HOST');
    const again = await data<LiveSessionRefDto>(
      await request(
        `/quizzes/${quiz.id}/live-session`,
        'POST',
        {},
        cookies.host,
      ),
      201,
    );
    assert.equal(again.id, session.id, 'opening the same quiz is idempotent');
    assert.equal(
      (await db.quiz.findUniqueOrThrow({ where: { id: quiz.id } })).status,
      'LOBBY',
    );
    const active = await data<{ id: string; quizId: string } | null>(
      await request('/live-sessions/active', 'GET', undefined, cookies.host),
    );
    assert.equal(active?.id, session.id);

    // Registration stays open in the lobby.
    await data(
      await request(`/quizzes/${quiz.id}/register`, 'POST', {}, cookies.late),
      201,
    );
    assert.equal(
      (
        await data<LiveSessionRefDto>(
          await request(
            `/quizzes/${quiz.id}/live-session`,
            'GET',
            undefined,
            cookies.a,
          ),
        )
      ).role,
      'PARTICIPANT',
    );

    // ---- Tickets and socket handshake.
    assert.equal(
      (
        await failure(
          await request(
            `/live-sessions/${session.id}/socket-ticket`,
            'POST',
            {},
            cookies.outsider,
          ),
        )
      ).code,
      'REGISTRATION_REQUIRED',
    );
    const ticket = async (role: (typeof roles)[number]) =>
      (
        await data<SocketTicketDto>(
          await request(
            `/live-sessions/${session.id}/socket-ticket`,
            'POST',
            {},
            cookies[role],
          ),
        )
      ).ticket;
    const open = async (role: (typeof roles)[number] | null) => {
      const socket = connect(base + LIVE_SOCKET_NAMESPACE, {
        auth: role ? { ticket: await ticket(role) } : {},
        transports: ['websocket'],
        reconnection: false,
        forceNew: true,
      });
      sockets.push(socket);
      return socket;
    };
    const emit = <T>(socket: ClientSocket, event: string, payload: unknown) =>
      socket.timeout(10_000).emitWithAck(event, payload) as Promise<
        SocketAck<T>
      >;
    const join = async (socket: ClientSocket) => {
      if (!socket.connected) await nextEvent(socket, 'connect');
      return emit<LiveSnapshotDto>(socket, LIVE_EVENTS.join, {
        liveSessionId: session.id,
      });
    };
    const ok = <T>(ack: SocketAck<T>) => {
      assert.ok(ack.ok, JSON.stringify(ack));
      return ack.data;
    };
    const errorCode = <T>(ack: SocketAck<T>) =>
      ack.ok ? 'OK' : ack.error.code;
    const nextEvent = <T>(socket: ClientSocket, event: string) =>
      new Promise<T>((resolve) => socket.once(event, resolve));

    const anonymous = await open(null);
    const refusal = await nextEvent<Error & { data?: { code: string } }>(
      anonymous,
      'connect_error',
    );
    assert.equal(refusal.data?.code, 'UNAUTHENTICATED');

    const foreign = connect(base + LIVE_SOCKET_NAMESPACE, {
      auth: { ticket: await ticket('host') },
      transports: ['websocket'],
      reconnection: false,
      forceNew: true,
      extraHeaders: { Origin: 'https://evil.example' },
    });
    sockets.push(foreign);
    await nextEvent(foreign, 'connect_error');
    assert.equal(foreign.connected, false, 'foreign origins are refused');

    const host = await open('host');
    const hostSnapshot = ok(await join(host)) as HostLiveSnapshotDto;
    assert.equal(hostSnapshot.role, 'HOST');
    assert.equal(hostSnapshot.state, 'LOBBY');
    assert.equal(hostSnapshot.questions.length, 1);
    assert.equal(hostSnapshot.counts.registered, 4);
    assert.equal(hostSnapshot.counts.connected, 0);

    // ---- Participant join: role-safe snapshot and host presence update.
    const presence = nextEvent<LivePresenceDto>(host, LIVE_EVENTS.presence);
    const phoneA = await open('a');
    const snapshotA = ok(await join(phoneA));
    assert.equal(snapshotA.role, 'PARTICIPANT');
    assert.equal('questions' in snapshotA, false);
    assert.equal('roster' in snapshotA, false);
    const update = await presence;
    assert.equal(update.connected, true);
    assert.equal(update.connectedCount, 1);

    // Payloads for another session and host commands are rejected.
    assert.equal(
      errorCode(
        await emit(phoneA, LIVE_EVENTS.join, { liveSessionId: randomUUID() }),
      ),
      'FORBIDDEN',
    );
    for (const event of [LIVE_EVENTS.quizStart, LIVE_EVENTS.quizEnd])
      assert.equal(
        errorCode(await emit(phoneA, event, { liveSessionId: session.id })),
        'FORBIDDEN',
      );
    assert.equal(
      errorCode(
        await emit(phoneA, LIVE_EVENTS.lateJoinSet, {
          liveSessionId: session.id,
          allow: false,
        }),
      ),
      'FORBIDDEN',
    );

    // ---- One active device: the newest socket replaces the previous one.
    const replaced = nextEvent(phoneA, LIVE_EVENTS.replaced);
    const dropped = nextEvent(phoneA, 'disconnect');
    const laptopA = await open('a');
    ok(await join(laptopA));
    await replaced;
    await dropped;
    assert.equal(
      ok(
        await emit<LiveSnapshotDto>(host, LIVE_EVENTS.sync, {
          liveSessionId: session.id,
        }),
      ).counts.connected,
      1,
      'a replaced device does not remove the active presence',
    );

    const phoneB = await open('b');
    ok(await join(phoneB));

    // ---- Registration changes in the lobby reach the host and evict leavers.
    const hostSnapshotAfter = (
      predicate: (snapshot: HostLiveSnapshotDto) => boolean,
    ) =>
      new Promise<HostLiveSnapshotDto>((resolve) => {
        const listener = (snapshot: HostLiveSnapshotDto) => {
          if (!predicate(snapshot)) return;
          host.off(LIVE_EVENTS.snapshot, listener);
          resolve(snapshot);
        };
        host.on(LIVE_EVENTS.snapshot, listener);
      });
    const registeredBefore = hostSnapshot.counts.registered;
    const afterRegister = hostSnapshotAfter(
      (snapshot) => snapshot.counts.registered === registeredBefore + 1,
    );
    await data(
      await request(`/quizzes/${quiz.id}/register`, 'POST', {}, cookies.drop),
      201,
    );
    const registeredSnapshot = await afterRegister;
    assert.ok(
      registeredSnapshot.roster.some((entry) => entry.name === 'Live drop'),
      'a lobby registration appears in the host roster',
    );
    const dropSocket = await open('drop');
    ok(await join(dropSocket));
    const removed = nextEvent<{ code: string }>(
      dropSocket,
      LIVE_EVENTS.removed,
    );
    const evicted = nextEvent(dropSocket, 'disconnect');
    const afterUnregister = hostSnapshotAfter(
      (snapshot) => snapshot.counts.registered === registeredBefore,
    );
    await data(
      await request(
        `/quizzes/${quiz.id}/register`,
        'DELETE',
        undefined,
        cookies.drop,
      ),
    );
    assert.equal((await removed).code, 'REGISTRATION_REQUIRED');
    await evicted;
    const unregisteredSnapshot = await afterUnregister;
    assert.equal(
      unregisteredSnapshot.roster.some((entry) => entry.name === 'Live drop'),
      false,
    );
    assert.equal(
      unregisteredSnapshot.counts.connected,
      2,
      'the unregistered participant no longer counts as connected',
    );
    const dropUserId = (
      await db.user.findUniqueOrThrow({ where: { email: emails[6]! } })
    ).id;
    assert.equal(
      await db.participantSession.count({
        where: { liveSessionId: session.id, userId: dropUserId },
      }),
      0,
      'lobby attendance is removed with the registration',
    );
    // Without registering again they cannot get a new socket ticket.
    assert.equal(
      (
        await failure(
          await request(
            `/live-sessions/${session.id}/socket-ticket`,
            'POST',
            {},
            cookies.drop,
          ),
        )
      ).code,
      'REGISTRATION_REQUIRED',
    );

    // ---- Start: everyone receives the new state; registration closes.
    const participantUpdate = nextEvent<LiveSnapshotDto>(
      laptopA,
      LIVE_EVENTS.snapshot,
    );
    const started = ok(
      await emit<HostLiveSnapshotDto>(host, LIVE_EVENTS.quizStart, {
        liveSessionId: session.id,
      }),
    );
    assert.equal(started.state, 'LIVE_IDLE');
    assert.ok(started.startedAt);
    const broadcast = await participantUpdate;
    assert.equal(broadcast.state, 'LIVE_IDLE');
    assert.equal(broadcast.role, 'PARTICIPANT');
    assert.equal(
      errorCode(
        await emit(host, LIVE_EVENTS.quizStart, { liveSessionId: session.id }),
      ),
      'INVALID_STATE_TRANSITION',
    );
    assert.equal(
      (await db.quiz.findUniqueOrThrow({ where: { id: quiz.id } })).status,
      'LIVE',
    );
    assert.equal(
      (
        await failure(
          await request(
            `/quizzes/${quiz.id}/register`,
            'POST',
            {},
            cookies.outsider,
          ),
        )
      ).code,
      'REGISTRATION_CLOSED',
    );
    assert.equal(
      (
        await request(
          `/quizzes/${quiz.id}`,
          'PATCH',
          { ...quizBasics, title: 'Changed' },
          cookies.host,
        )
      ).status,
      409,
      'quiz content locks once live',
    );

    // ---- Late join: first-time entrants need it; returning attendees don't.
    ok(
      await emit(host, LIVE_EVENTS.lateJoinSet, {
        liveSessionId: session.id,
        allow: false,
      }),
    );
    const lateSocket = await open('late');
    assert.equal(errorCode(await join(lateSocket)), 'LATE_JOIN_DISABLED');
    const leftB = nextEvent<LivePresenceDto>(host, LIVE_EVENTS.presence);
    phoneB.disconnect();
    const leaveUpdate = await leftB;
    assert.equal(leaveUpdate.connected, false);
    assert.equal(leaveUpdate.connectedCount, 1);
    const returningB = await open('b');
    const restored = ok(await join(returningB));
    assert.equal(restored.state, 'LIVE_IDLE', 'reconnect restores live state');
    ok(
      await emit(host, LIVE_EVENTS.lateJoinSet, {
        liveSessionId: session.id,
        allow: true,
      }),
    );
    ok(await join(lateSocket));

    // ---- End (minimal Phase 5): completes quiz and frees the host.
    const ended = ok(
      await emit<HostLiveSnapshotDto>(host, LIVE_EVENTS.quizEnd, {
        liveSessionId: session.id,
      }),
    );
    assert.equal(ended.state, 'COMPLETED');
    assert.ok(
      errorCode(
        await emit(host, LIVE_EVENTS.quizEnd, { liveSessionId: session.id }),
      ) === 'OK',
      'ending is idempotent',
    );
    const afterEnd = await open('c');
    assert.equal(errorCode(await join(afterEnd)), 'QUIZ_COMPLETED');
    assert.equal(
      (await db.quiz.findUniqueOrThrow({ where: { id: quiz.id } })).status,
      'COMPLETED',
    );
    const next = await data<LiveSessionRefDto>(
      await request(
        `/quizzes/${third.id}/live-session`,
        'POST',
        {},
        cookies.host,
      ),
      201,
    );
    sessionIds.add(next.id);
    await live.end(next.id, hostId);
  },
);
