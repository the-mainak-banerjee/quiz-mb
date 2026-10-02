'use client';

import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import {
  QUIZ_STATUS_EVENT,
  QUIZ_STATUS_NAMESPACE,
  type QuizStatusDto,
} from '@quizmb/contracts';
import { API_ORIGIN } from '@/lib/api/config';
import { liveApi } from '@/lib/api/live';

type Status = QuizStatusDto['status'];

/**
 * Live lifecycle status for the public quiz page (lobby opened or closed,
 * quiz started or ended) so the page reacts without a reload. Read-only: the
 * socket uses a watch ticket that cannot join the live room. When the socket
 * is unavailable the page keeps its server-rendered status.
 */
export function useQuizStatus(
  quizId: string,
  initial: Status,
  enabled: boolean,
) {
  const [status, setStatus] = useState<Status>(initial);

  useEffect(() => {
    if (!enabled) return;
    const socket = io(`${API_ORIGIN}${QUIZ_STATUS_NAMESPACE}`, {
      transports: ['websocket'],
      reconnectionAttempts: 10,
      reconnectionDelayMax: 10_000,
      // A fresh ticket for every (re)connect: web and API are different sites.
      auth: (done) => {
        liveApi.watchTicket(quizId).then(
          ({ ticket }) => done({ ticket }),
          () => done({}),
        );
      },
    });
    socket.on(QUIZ_STATUS_EVENT, (update: QuizStatusDto) => {
      if (update.quizId === quizId) setStatus(update.status);
    });
    return () => {
      socket.removeAllListeners();
      socket.disconnect();
    };
  }, [quizId, enabled]);

  return status;
}
