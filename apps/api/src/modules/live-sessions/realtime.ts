import type { Server as HttpServer } from 'node:http';
import { Server, type Namespace, type Socket } from 'socket.io';
import type { Logger } from 'pino';
import type { z } from 'zod';
import {
  LIVE_EVENTS,
  LIVE_SOCKET_NAMESPACE,
  lateJoinCommandSchema,
  liveSessionCommandSchema,
  type LiveCountDto,
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
import type { LiveSessionRow } from './repository.js';
import type { LiveSessionsService } from './service.js';
import { ROOM_AUDIENCE, SOCKET_EVENT, liveRoom } from './constants.js';

type SocketData = {
  userId: string;
  /** Session the handshake ticket was issued for. */
  ticketSessionId: string;
  role?: LiveRole | undefined;
};
type LiveSocket = Socket<
  Record<string, never>,
  Record<string, never>,
  Record<string, never>,
  SocketData
>;

function failure(error: unknown, logger: Logger, event: string) {
  if (error instanceof ApiError)
    return { ok: false, error: { code: error.code, message: error.message } };
  logger.error(
    { event, code: ERROR_CODE.INTERNAL_ERROR },
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
      ({ userId, liveSessionId }) => {
        socket.data = { userId, ticketSessionId: liveSessionId };
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

  async function broadcast(session: LiveSessionRow) {
    const [host, participant] = await Promise.all([
      service.hostSnapshot(session),
      service.participantSnapshot(session),
    ]);
    nsp
      .to(liveRoom(session.id, ROOM_AUDIENCE.HOST))
      .emit(LIVE_EVENTS.snapshot, host);
    nsp
      .to(liveRoom(session.id, ROOM_AUDIENCE.PARTICIPANTS))
      .emit(LIVE_EVENTS.snapshot, participant);
  }

  // Participants see the connected count too. Updates are throttled per
  // session (first change immediately, then at most one per interval with
  // the latest value) so a burst of joins does not fan out N² messages.
  // In-memory only: this costs no Redis commands.
  const COUNT_INTERVAL_MS = 2_000;
  const countTimers = new Map<string, NodeJS.Timeout>();
  const latestCounts = new Map<string, number>();
  function sendCount(liveSessionId: string, connectedCount: number) {
    const payload: LiveCountDto = { connectedCount };
    nsp
      .to(liveRoom(liveSessionId, ROOM_AUDIENCE.PARTICIPANTS))
      .emit(LIVE_EVENTS.count, payload);
  }
  function publishCount(liveSessionId: string, connectedCount: number) {
    if (countTimers.has(liveSessionId)) {
      latestCounts.set(liveSessionId, connectedCount);
      return;
    }
    sendCount(liveSessionId, connectedCount);
    const timer = setTimeout(() => {
      countTimers.delete(liveSessionId);
      const latest = latestCounts.get(liveSessionId);
      latestCounts.delete(liveSessionId);
      if (latest !== undefined) publishCount(liveSessionId, latest);
    }, COUNT_INTERVAL_MS);
    timer.unref();
    countTimers.set(liveSessionId, timer);
  }

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
        await broadcast(session);
        return service.hostSnapshot(session);
      },
    );

    on(
      LIVE_EVENTS.lateJoinSet,
      lateJoinCommandSchema,
      async ({ liveSessionId, allow }) => {
        requireHost();
        const session = await service.setLateJoin(liveSessionId, userId, allow);
        await broadcast(session);
        return service.hostSnapshot(session);
      },
    );

    on(
      LIVE_EVENTS.quizEnd,
      liveSessionCommandSchema,
      async ({ liveSessionId }) => {
        requireHost();
        const session = await service.end(liveSessionId, userId);
        logger.info({ liveSessionId }, 'Live quiz ended');
        await broadcast(session);
        return service.hostSnapshot(session);
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
        socket.data.role = undefined;
        return null;
      },
    );

    async function release() {
      const liveSessionId = socket.data.ticketSessionId;
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

    socket.on(SOCKET_EVENT.DISCONNECT, () => {
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
