import type { Server as HttpServer } from 'node:http';
import { Server, type Namespace, type Socket } from 'socket.io';
import type { Logger } from 'pino';
import type { z } from 'zod';
import {
  LIVE_EVENTS,
  LIVE_SOCKET_NAMESPACE,
  lateJoinCommandSchema,
  liveSessionCommandSchema,
  type LivePresenceDto,
  type LiveRole,
  type SocketAck,
} from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';
import type { LiveSessionRow } from './repository.js';
import type { LiveSessionsService } from './service.js';

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

const room = (id: string, audience?: 'host' | 'participants') =>
  audience ? `quiz:${id}:${audience}` : `quiz:${id}`;

function failure(error: unknown, logger: Logger, event: string) {
  if (error instanceof ApiError)
    return { ok: false, error: { code: error.code, message: error.message } };
  logger.error({ event, code: 'INTERNAL_ERROR' }, 'Live socket command failed');
  return {
    ok: false,
    error: {
      code: 'INTERNAL_ERROR',
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
    nsp.to(room(session.id, 'host')).emit(LIVE_EVENTS.snapshot, host);
    nsp
      .to(room(session.id, 'participants'))
      .emit(LIVE_EVENTS.snapshot, participant);
  }

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
              throw new ApiError(422, 'VALIDATION_ERROR', 'Invalid request.');
            if (
              (parsed.data as { liveSessionId: string }).liveSessionId !==
              socket.data.ticketSessionId
            )
              throw new ApiError(
                403,
                'FORBIDDEN',
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
          'NOT_JOINED',
          'Join the live session before sending commands.',
        );
      return socket.data.role;
    }

    function requireHost() {
      if (requireJoined() !== 'HOST')
        throw new ApiError(
          403,
          'FORBIDDEN',
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
          room(liveSessionId),
          room(liveSessionId, result.role === 'HOST' ? 'host' : 'participants'),
        ]);
        if (result.replacedSocketId) {
          nsp.to(result.replacedSocketId).emit(LIVE_EVENTS.replaced, {
            reason: 'A newer session was opened for this quiz.',
          });
          nsp.in(result.replacedSocketId).disconnectSockets(true);
          logger.info({ liveSessionId, userId }, 'Live participant replaced');
        }
        if (result.role === 'PARTICIPANT' && result.newlyConnected) {
          const presence: LivePresenceDto = {
            userId,
            connected: true,
            connectedCount: result.snapshot.counts.connected,
          };
          nsp
            .to(room(liveSessionId, 'host'))
            .emit(LIVE_EVENTS.presence, presence);
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
          role === 'PARTICIPANT' &&
          !(await service.isActiveSocket(liveSessionId, userId, socket.id))
        )
          throw new ApiError(
            409,
            'SESSION_REPLACED',
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

    async function release() {
      const liveSessionId = socket.data.ticketSessionId;
      if (socket.data.role !== 'PARTICIPANT') return;
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
      nsp.to(room(liveSessionId, 'host')).emit(LIVE_EVENTS.presence, presence);
    }

    on(
      LIVE_EVENTS.leave,
      liveSessionCommandSchema,
      async ({ liveSessionId }) => {
        await release();
        await socket.leave(room(liveSessionId));
        await socket.leave(room(liveSessionId, 'participants'));
        await socket.leave(room(liveSessionId, 'host'));
        socket.data.role = undefined;
        return null;
      },
    );

    socket.on('disconnect', () => {
      release().catch(() =>
        logger.warn({ code: 'LIVE_UNAVAILABLE' }, 'Presence release failed'),
      );
    });
  });

  return nsp;
}
