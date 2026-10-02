import type { Server } from 'socket.io';
import type { Logger } from 'pino';
import {
  QUIZ_STATUS_EVENT,
  QUIZ_STATUS_NAMESPACE,
  type QuizStatusDto,
} from '@quizmb/contracts';
import type { ApiError } from '../../http/api-error.js';
import {
  DOMAIN_EVENT,
  type DomainEvents,
} from '../../infrastructure/domain-events.js';
import type { LiveSessionsService } from './service.js';
import { statusRoom } from './constants.js';

/**
 * Read-only lifecycle updates for the public quiz page. A socket watches the
 * single quiz named in its watch ticket: it receives the current status on
 * connect and every change afterwards. No client commands, no Redis: changes
 * arrive as in-process domain events.
 */
export function attachQuizStatusRealtime(
  io: Server,
  service: LiveSessionsService,
  logger: Logger,
  events: DomainEvents,
) {
  const nsp = io.of(QUIZ_STATUS_NAMESPACE);

  nsp.use((socket, next) => {
    const auth = socket.handshake.auth as { ticket?: unknown } | undefined;
    service.tickets.verifyWatch(auth?.ticket).then(
      ({ quizId }) => {
        socket.data = { quizId };
        next();
      },
      (error: ApiError) => {
        const refused = new Error(error.message) as Error & { data?: unknown };
        refused.data = { code: error.code };
        next(refused);
      },
    );
  });

  nsp.on('connection', (socket) => {
    const { quizId } = socket.data as { quizId: string };
    void socket.join(statusRoom(quizId));
    service.quizStatus(quizId).then(
      (status) => socket.emit(QUIZ_STATUS_EVENT, status),
      () => socket.disconnect(true),
    );
  });

  events.on(DOMAIN_EVENT.quizStatusChanged, ({ quizId, status }) => {
    const payload: QuizStatusDto = { quizId, status };
    nsp.to(statusRoom(quizId)).emit(QUIZ_STATUS_EVENT, payload);
    logger.debug({ quizId, status }, 'Quiz status broadcast');
  });

  return nsp;
}
