import type { Server as HttpServer } from 'node:http';
import { Server, type Namespace, type Socket } from 'socket.io';
import type { Logger } from 'pino';
import type { z } from 'zod';
import {
  LIVE_EVENTS,
  LIVE_SOCKET_NAMESPACE,
  answerSubmitCommandSchema,
  lateJoinCommandSchema,
  liveSessionCommandSchema,
  questionStartCommandSchema,
  type LiveCountDto,
  type LiveHostPresenceDto,
  type LivePresenceDto,
  type LiveRemovedDto,
  type LiveRole,
  type SocketAck,
  ERROR_CODE,
  LIVE_ROLE,
} from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';
import {
  DOMAIN_EVENT,
  type DomainEvents,
} from '../../infrastructure/domain-events.js';
import type { AskedQuestionRow, LiveSessionRow } from './repository.js';
import type { LiveSessionsService } from './service.js';
import {
  HOST_AWAY_GRACE_MS,
  ROOM_AUDIENCE,
  SOCKET_EVENT,
  SOCKET_RATE_BUCKET,
  authFamilyRoom,
  liveRoom,
} from './constants.js';
import { socketRateLimiter } from './socket-rate.js';

type SocketData = {
  userId: string;
  /** Session the handshake ticket was issued for. */
  ticketSessionId: string;
  /** Sign-in session family the ticket was issued under. */
  authFamilyId: string;
  role?: LiveRole | undefined;
};
type LiveSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>;

/**
 * Leading + trailing throttle per key: the first value goes out at once,
 * then at most one per interval carrying the latest value. In memory only,
 * so it costs no Redis commands (single API instance).
 */
function keyedThrottle<T>(
  intervalMs: number,
  send: (key: string, value: T) => void,
) {
  const timers = new Map<string, NodeJS.Timeout>();
  const latest = new Map<string, T>();
  function publish(key: string, value: T) {
    if (timers.has(key)) {
      latest.set(key, value);
      return;
    }
    send(key, value);
    const timer = setTimeout(() => {
      timers.delete(key);
      if (!latest.has(key)) return;
      const next = latest.get(key) as T;
      latest.delete(key);
      publish(key, next);
    }, intervalMs);
    timer.unref();
    timers.set(key, timer);
  }
  return publish;
}

function failure(error: unknown, logger: Logger, event: string) {
  if (error instanceof ApiError)
    return { ok: false, error: { code: error.code, message: error.message } };
  logger.error(
    { event, code: ERROR_CODE.INTERNAL_ERROR, err: error },
    'Live socket command failed',
  );
  return {
    ok: false,
    error: {
      code: ERROR_CODE.INTERNAL_ERROR,
      message: 'Something went wrong. Please try again.',
    },
  } as const;
}

/**
 * Socket.IO server restricted to the configured web origins. `cors` covers
 * HTTP polling; `allowRequest` also checks WebSocket upgrades. Requests with
 * no Origin (non-browser clients) still need a valid ticket to connect.
 */
export function createSocketServer(
  server: HttpServer,
  allowedOrigins: readonly string[],
) {
  return new Server(server, {
    cors: { origin: [...allowedOrigins] },
    serveClient: false,
    allowRequest: (request, callback) => {
      const origin = request.headers.origin;
      callback(null, origin === undefined || allowedOrigins.includes(origin));
    },
  });
}

/**
 * Socket.IO transport for live sessions. Handlers only authenticate,
 * validate and delegate; lifecycle rules live in LiveSessionsService.
 */
export function attachLiveRealtime(
  io: Server,
  service: LiveSessionsService,
  logger: Logger,
  events?: DomainEvents,
) {
  const nsp: Namespace = io.of(LIVE_SOCKET_NAMESPACE);

  // Cookie-free handshake: the web and API are on different sites.
  nsp.use((socket, next) => {
    const auth = socket.handshake.auth as { ticket?: unknown } | undefined;
    service.tickets.verify(auth?.ticket).then(
      ({ userId, liveSessionId, authFamilyId }) => {
        socket.data = {
          userId,
          ticketSessionId: liveSessionId,
          authFamilyId,
        };
        next();
      },
      (error: ApiError) => {
        const refused = new Error(error.message) as Error & {
          data?: unknown;
        };
        refused.data = { code: error.code };
        next(refused);
      },
    );
  });

  /**
   * Sends role-safe snapshots after a lifecycle change. Participants are
   * sent theirs as soon as it is ready; the host snapshot is returned so
   * the command's ack reuses it instead of building it twice.
   */
  async function broadcast(
    session: LiveSessionRow,
    preloaded?: AskedQuestionRow | null,
  ) {
    const asked =
      preloaded === undefined ? await service.askedFor(session) : preloaded;
    const participants = service
      .participantSnapshot(session, undefined, asked)
      .then((snapshot) =>
        nsp
          .to(liveRoom(session.id, ROOM_AUDIENCE.PARTICIPANTS))
          .emit(LIVE_EVENTS.snapshot, snapshot),
      );
    const host = await service.hostSnapshot(session, asked);
    nsp
      .to(liveRoom(session.id, ROOM_AUDIENCE.HOST))
      .emit(LIVE_EVENTS.snapshot, host);
    await participants;
    return host;
  }

  // Participants see the connected count too, throttled per session so a
  // burst of joins does not fan out N² messages.
  const COUNT_INTERVAL_MS = 2_000;
  const publishCount = keyedThrottle<number>(
    COUNT_INTERVAL_MS,
    (liveSessionId, connectedCount) => {
      const payload: LiveCountDto = { connectedCount };
      nsp
        .to(liveRoom(liveSessionId, ROOM_AUDIENCE.PARTICIPANTS))
        .emit(LIVE_EVENTS.count, payload);
    },
  );

  function sendHostPresence(liveSessionId: string, hostConnected: boolean) {
    const payload: LiveHostPresenceDto = { hostConnected };
    nsp
      .to(liveRoom(liveSessionId, ROOM_AUDIENCE.PARTICIPANTS))
      .emit(LIVE_EVENTS.hostPresence, payload);
  }

  /**
   * The host's last connection closed. Participants are told only if the
   * host is still away after the grace period, so a refresh goes unnoticed;
   * the quiz itself keeps running either way.
   */
  function hostDisconnected(liveSessionId: string, socketId: string) {
    if (!service.hostLeft(liveSessionId, socketId)) return;
    setTimeout(() => {
      if (service.hostConnected(liveSessionId)) return;
      sendHostPresence(liveSessionId, false);
      logger.info({ liveSessionId }, 'Live host away');
    }, HOST_AWAY_GRACE_MS + 100).unref();
  }

  // Host-only answer progress for the active question: one database read
  // per interval however many answers arrive.
  const PROGRESS_INTERVAL_MS = 1_000;
  const publishProgress = keyedThrottle<string>(
    PROGRESS_INTERVAL_MS,
    (liveSessionId, askedQuestionId) => {
      service
        .progressFor(liveSessionId, askedQuestionId)
        .then((progress) => {
          if (!progress) return;
          nsp
            .to(liveRoom(liveSessionId, ROOM_AUDIENCE.HOST))
            .emit(LIVE_EVENTS.submissions, progress);
        })
        .catch(() =>
          logger.warn(
            { liveSessionId, code: ERROR_CODE.LIVE_UNAVAILABLE },
            'Answer progress update failed',
          ),
        );
    },
  );

  // Logout or a replayed refresh token ends the sign-in: its sockets go too.
  // Told first (like other removals), so the page shows why instead of
  // trying to reconnect.
  events?.on(DOMAIN_EVENT.authSessionsRevoked, ({ familyIds }) => {
    const signedOut: LiveRemovedDto = {
      code: ERROR_CODE.UNAUTHENTICATED,
      message:
        'You were signed out, so you left this live quiz. Sign in again to rejoin.',
    };
    for (const familyId of familyIds) {
      const room = authFamilyRoom(familyId);
      nsp.to(room).emit(LIVE_EVENTS.removed, signedOut);
      nsp.in(room).disconnectSockets(true);
    }
  });

  // The server closed an unstarted lobby (it expired): like a host closing
  // it, everyone is told why and disconnected.
  events?.on(
    DOMAIN_EVENT.liveSessionClosed,
    ({ liveSessionId, code, message }) => {
      const closed: LiveRemovedDto = { code, message };
      nsp.to(liveRoom(liveSessionId)).emit(LIVE_EVENTS.removed, closed);
      nsp.in(liveRoom(liveSessionId)).disconnectSockets(true);
    },
  );

  // The server ended a started quiz (host away too long, or the maximum
  // length): announced exactly like the host's "End quiz".
  events?.on(DOMAIN_EVENT.liveSessionEnded, ({ liveSessionId, reason }) => {
    announceEnded(liveSessionId).catch(() =>
      logger.warn(
        { liveSessionId, reason, code: ERROR_CODE.LIVE_UNAVAILABLE },
        'Quiz end broadcast failed',
      ),
    );
  });

  /**
   * Each participant gets their own final result first; the final
   * leaderboard stays hidden until the host reveals it.
   */
  async function announceEnded(liveSessionId: string) {
    for (const { socketId, result } of await service.finalResultDeliveries(
      liveSessionId,
    ))
      nsp.to(socketId).emit(LIVE_EVENTS.quizEnded, result);
    return broadcast(await service.session(liveSessionId));
  }

  // A question closed (timer, recovery path or end): the host gets the new
  // snapshot and each connected participant a personal one with their own
  // answer and the shared reveal; recalculated standings follow.
  events?.on(
    DOMAIN_EVENT.questionEnded,
    ({ liveSessionId, askedQuestionId }) => {
      service
        .questionEndedDeliveries(liveSessionId)
        .then(async ({ host, participants }) => {
          nsp
            .to(liveRoom(liveSessionId, ROOM_AUDIENCE.HOST))
            .emit(LIVE_EVENTS.snapshot, host);
          for (const { socketId, snapshot } of participants)
            nsp.to(socketId).emit(LIVE_EVENTS.snapshot, snapshot);
          logger.info(
            { liveSessionId, askedQuestionId },
            'Live question ended',
          );
          const standings = await service.standingDeliveries(
            liveSessionId,
            askedQuestionId,
          );
          for (const { socketId, standing } of standings)
            nsp.to(socketId).emit(LIVE_EVENTS.standing, standing);
        })
        .catch(() =>
          logger.warn(
            { liveSessionId, code: ERROR_CODE.LIVE_UNAVAILABLE },
            'Question end broadcast failed',
          ),
        );
    },
  );

  // Registration can change while the lobby is open: keep the host's roster
  // and counts current, and remove participants who unregistered.
  events?.on(
    DOMAIN_EVENT.registrationChanged,
    ({ quizId, userId, registered }) => {
      service
        .applyRegistrationChange(quizId, userId, registered)
        .then(async (result) => {
          if (!result) return;
          if (result.removedSocketId) {
            const removed: LiveRemovedDto = {
              code: ERROR_CODE.REGISTRATION_REQUIRED,
              message:
                'You unregistered from this quiz, so you left its lobby.',
            };
            nsp.to(result.removedSocketId).emit(LIVE_EVENTS.removed, removed);
            nsp.in(result.removedSocketId).disconnectSockets(true);
          }
          const hostSnapshot = await service.hostSnapshot(result.session);
          nsp
            .to(liveRoom(result.session.id, ROOM_AUDIENCE.HOST))
            .emit(LIVE_EVENTS.snapshot, hostSnapshot);
          if (result.removedSocketId)
            publishCount(result.session.id, hostSnapshot.counts.connected);
        })
        .catch(() =>
          logger.warn(
            { quizId, code: ERROR_CODE.LIVE_UNAVAILABLE },
            'Live registration update failed',
          ),
        );
    },
  );

  nsp.on('connection', (raw) => {
    const socket = raw as unknown as LiveSocket;
    const { userId } = socket.data;
    void socket.join(authFamilyRoom(socket.data.authFamilyId));
    const withinBudget = socketRateLimiter();

    function on<Schema extends z.ZodType, Result>(
      event: string,
      schema: Schema,
      handler: (payload: z.infer<Schema>) => Promise<Result>,
    ) {
      socket.on(
        event as never,
        (async (
          payload: unknown,
          ack?: (response: SocketAck<Result>) => void,
        ) => {
          let response: SocketAck<Result>;
          try {
            const bucket = SOCKET_RATE_BUCKET[event];
            const budget = bucket ? withinBudget(bucket) : null;
            if (budget?.firstRefusal)
              logger.warn(
                { event, liveSessionId: socket.data.ticketSessionId, userId },
                'Live commands rate limited',
              );
            if (budget && !budget.allowed)
              throw new ApiError(
                429,
                ERROR_CODE.RATE_LIMITED,
                'Too many requests. Please wait a moment and try again.',
              );
            const parsed = schema.safeParse(payload);
            if (!parsed.success)
              throw new ApiError(
                422,
                ERROR_CODE.VALIDATION_ERROR,
                'Invalid request.',
              );
            if (
              (parsed.data as { liveSessionId: string }).liveSessionId !==
              socket.data.ticketSessionId
            )
              throw new ApiError(
                403,
                ERROR_CODE.FORBIDDEN,
                'This connection is not authorised for that live session.',
              );
            response = { ok: true, data: await handler(parsed.data) };
          } catch (error) {
            response = failure(error, logger, event) as SocketAck<Result>;
            // Refusals are part of normal play (late answers, invalid host
            // steps); log what was refused, never what was sent. Rate-limited
            // commands were logged once above.
            if (
              error instanceof ApiError &&
              error.code !== ERROR_CODE.RATE_LIMITED
            )
              logger.info(
                {
                  event,
                  code: error.code,
                  liveSessionId: socket.data.ticketSessionId,
                  userId,
                },
                'Live command refused',
              );
          }
          if (typeof ack === 'function') ack(response);
        }) as never,
      );
    }

    function requireJoined() {
      if (!socket.data.role)
        throw new ApiError(
          409,
          ERROR_CODE.NOT_JOINED,
          'Join the live session before sending commands.',
        );
      return socket.data.role;
    }

    function requireHost() {
      if (requireJoined() !== LIVE_ROLE.HOST)
        throw new ApiError(
          403,
          ERROR_CODE.FORBIDDEN,
          'Only the quiz host can control this live session.',
        );
    }

    on(
      LIVE_EVENTS.join,
      liveSessionCommandSchema,
      async ({ liveSessionId }) => {
        const result = await service.join(liveSessionId, userId, socket.id);
        socket.data.role = result.role;
        await socket.join([
          liveRoom(liveSessionId),
          liveRoom(
            liveSessionId,
            result.role === LIVE_ROLE.HOST
              ? ROOM_AUDIENCE.HOST
              : ROOM_AUDIENCE.PARTICIPANTS,
          ),
        ]);
        if (result.role === LIVE_ROLE.HOST)
          logger.info(
            { liveSessionId, userId, returned: result.hostReturned },
            'Live host joined',
          );
        else
          logger.info(
            { liveSessionId, userId },
            result.firstEntry
              ? 'Live participant joined'
              : 'Live participant reconnected',
          );
        if (result.hostReturned) sendHostPresence(liveSessionId, true);
        if (result.replacedSocketId) {
          nsp.to(result.replacedSocketId).emit(LIVE_EVENTS.replaced, {
            reason: 'A newer session was opened for this quiz.',
          });
          nsp.in(result.replacedSocketId).disconnectSockets(true);
          logger.info({ liveSessionId, userId }, 'Live participant replaced');
        }
        if (result.role === LIVE_ROLE.PARTICIPANT && result.newlyConnected) {
          const presence: LivePresenceDto = {
            userId,
            connected: true,
            connectedCount: result.snapshot.counts.connected,
          };
          nsp
            .to(liveRoom(liveSessionId, ROOM_AUDIENCE.HOST))
            .emit(LIVE_EVENTS.presence, presence);
          publishCount(liveSessionId, presence.connectedCount);
        }
        return result.snapshot;
      },
    );

    on(
      LIVE_EVENTS.sync,
      liveSessionCommandSchema,
      async ({ liveSessionId }) => {
        const role = requireJoined();
        if (
          role === LIVE_ROLE.PARTICIPANT &&
          !(await service.isActiveSocket(liveSessionId, userId, socket.id))
        )
          throw new ApiError(
            409,
            ERROR_CODE.SESSION_REPLACED,
            'This quiz is open on another device.',
          );
        return service.sync(liveSessionId, userId, role);
      },
    );

    on(
      LIVE_EVENTS.quizStart,
      liveSessionCommandSchema,
      async ({ liveSessionId }) => {
        requireHost();
        const session = await service.start(liveSessionId, userId);
        logger.info({ liveSessionId }, 'Live quiz started');
        return broadcast(session);
      },
    );

    on(
      LIVE_EVENTS.questionStart,
      questionStartCommandSchema,
      async ({ liveSessionId, questionId }) => {
        requireHost();
        const { session, asked } = await service.startQuestion(
          liveSessionId,
          userId,
          questionId,
        );
        logger.info(
          {
            liveSessionId,
            askedQuestionId: asked.id,
            number: asked.sequenceNumber,
          },
          'Live question started',
        );
        return broadcast(session, asked);
      },
    );

    on(
      LIVE_EVENTS.leaderboardGet,
      liveSessionCommandSchema,
      async ({ liveSessionId }) => {
        requireHost();
        return service.hostLeaderboard(liveSessionId, userId);
      },
    );

    for (const [event, shown] of [
      [LIVE_EVENTS.leaderboardShow, true],
      [LIVE_EVENTS.leaderboardHide, false],
    ] as const)
      on(event, liveSessionCommandSchema, async ({ liveSessionId }) => {
        requireHost();
        const session = await service.setLeaderboard(
          liveSessionId,
          userId,
          shown,
        );
        logger.info({ liveSessionId, shown }, 'Live leaderboard toggled');
        return broadcast(session);
      });

    on(LIVE_EVENTS.answerSubmit, answerSubmitCommandSchema, async (command) => {
      if (requireJoined() !== LIVE_ROLE.PARTICIPANT)
        throw new ApiError(
          403,
          ERROR_CODE.FORBIDDEN,
          'Only participants can answer questions.',
        );
      const answer = await service.submit(userId, socket.id, command);
      // Debug only: one line per answer is too much at info for big rooms.
      logger.debug(
        {
          liveSessionId: command.liveSessionId,
          askedQuestionId: command.askedQuestionId,
          userId,
        },
        'Live answer accepted',
      );
      publishProgress(command.liveSessionId, command.askedQuestionId);
      return answer;
    });

    on(
      LIVE_EVENTS.lateJoinSet,
      lateJoinCommandSchema,
      async ({ liveSessionId, allow }) => {
        requireHost();
        const session = await service.setLateJoin(liveSessionId, userId, allow);
        return broadcast(session);
      },
    );

    on(
      LIVE_EVENTS.quizEnd,
      liveSessionCommandSchema,
      async ({ liveSessionId }) => {
        requireHost();
        await service.end(liveSessionId, userId);
        logger.info({ liveSessionId }, 'Live quiz ended');
        return announceEnded(liveSessionId);
      },
    );

    on(
      LIVE_EVENTS.finalLeaderboardShow,
      liveSessionCommandSchema,
      async ({ liveSessionId }) => {
        requireHost();
        const session = await service.showFinalLeaderboard(
          liveSessionId,
          userId,
        );
        logger.info({ liveSessionId }, 'Final leaderboard shown');
        return broadcast(session);
      },
    );

    on(
      LIVE_EVENTS.lobbyClose,
      liveSessionCommandSchema,
      async ({ liveSessionId }) => {
        requireHost();
        await service.closeLobby(liveSessionId, userId);
        logger.info({ liveSessionId }, 'Live lobby closed');
        const closed: LiveRemovedDto = {
          code: ERROR_CODE.LOBBY_CLOSED,
          message: 'The host closed the lobby before starting the quiz.',
        };
        // Everyone else in the room (participants and other host tabs) is
        // told and disconnected; the closing socket gets the ack instead.
        const others = nsp.to(liveRoom(liveSessionId)).except(socket.id);
        others.emit(LIVE_EVENTS.removed, closed);
        nsp
          .in(liveRoom(liveSessionId))
          .except(socket.id)
          .disconnectSockets(true);
        service.hostLeft(liveSessionId, socket.id);
        socket.data.role = undefined;
        return null;
      },
    );

    async function release() {
      const liveSessionId = socket.data.ticketSessionId;
      // A no-op unless this socket joined as the host.
      hostDisconnected(liveSessionId, socket.id);
      if (socket.data.role !== LIVE_ROLE.PARTICIPANT) return;
      socket.data.role = undefined;
      const connectedCount = await service.leave(
        liveSessionId,
        userId,
        socket.id,
      );
      if (connectedCount === null) return;
      const presence: LivePresenceDto = {
        userId,
        connected: false,
        connectedCount,
      };
      nsp
        .to(liveRoom(liveSessionId, ROOM_AUDIENCE.HOST))
        .emit(LIVE_EVENTS.presence, presence);
      publishCount(liveSessionId, connectedCount);
    }

    on(
      LIVE_EVENTS.leave,
      liveSessionCommandSchema,
      async ({ liveSessionId }) => {
        await release();
        await socket.leave(liveRoom(liveSessionId));
        await socket.leave(liveRoom(liveSessionId, ROOM_AUDIENCE.PARTICIPANTS));
        await socket.leave(liveRoom(liveSessionId, ROOM_AUDIENCE.HOST));
        socket.data.role = undefined;
        return null;
      },
    );

    socket.on(SOCKET_EVENT.DISCONNECT, (reason: string) => {
      if (socket.data.role)
        logger.info(
          {
            liveSessionId: socket.data.ticketSessionId,
            userId,
            role: socket.data.role,
            reason,
          },
          'Live socket disconnected',
        );
      release().catch(() =>
        logger.warn(
          { code: ERROR_CODE.LIVE_UNAVAILABLE },
          'Presence release failed',
        ),
      );
    });
  });

  return nsp;
}
