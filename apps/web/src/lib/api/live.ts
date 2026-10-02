import type { LiveSessionRefDto, SocketTicketDto } from '@quizmb/contracts';
import { api } from './browser';
import { API_ROUTES } from './routes';

const auth = { authenticated: true };

export const liveApi = {
  /** Opens (or resumes) the host's lobby for a published quiz. */
  openLobby: (quizId: string) =>
    api.post<LiveSessionRefDto>(
      API_ROUTES.QUIZZES.LIVE_SESSION(quizId),
      {},
      auth,
    ),
  /** Short-lived ticket to watch one quiz's lifecycle status. */
  watchTicket: (quizId: string) =>
    api.post<SocketTicketDto>(
      API_ROUTES.QUIZZES.WATCH_TICKET(quizId),
      {},
      auth,
    ),
  /** Short-lived Socket.IO handshake ticket; request a new one per connect. */
  socketTicket: (liveSessionId: string) =>
    api.post<SocketTicketDto>(
      API_ROUTES.LIVE_SESSIONS.SOCKET_TICKET(liveSessionId),
      {},
      auth,
    ),
};
