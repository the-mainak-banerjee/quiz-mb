'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  LIVE_EVENTS,
  LIVE_SOCKET_NAMESPACE,
  type LivePresenceDto,
  type LiveRemovedDto,
  type LiveSnapshotDto,
  type SocketAck,
} from '@quizmb/contracts';
import { API_ORIGIN } from '@/lib/api/config';
import { apiError } from '@/lib/api/client';
import { liveApi } from '@/lib/api/live';

export type LiveConnection =
  'connecting' | 'connected' | 'reconnecting' | 'replaced' | 'failed';

export type LiveFailure = { code: string; message: string };

/**
 * Automatic reconnect attempts before giving up and offering a manual retry.
 * Shared by Socket.IO transport reconnects, refused-handshake retries and the
 * reconnecting screen so the displayed counter never exceeds it.
 */
export const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Join refusals that retrying cannot fix. Anything else (timeouts,
 * LIVE_UNAVAILABLE, INTERNAL_ERROR, OPERATION_IN_PROGRESS) is retried.
 */
const PERMANENT_JOIN_ERRORS = new Set([
  'REGISTRATION_REQUIRED',
  'LATE_JOIN_DISABLED',
  'QUIZ_COMPLETED',
  'SESSION_NOT_FOUND',
  'FORBIDDEN',
  'VALIDATION_ERROR',
]);

function applyPresence(
  snapshot: LiveSnapshotDto | null,
  presence: LivePresenceDto,
): LiveSnapshotDto | null {
  if (!snapshot) return snapshot;
  const counts = { ...snapshot.counts, connected: presence.connectedCount };
  if (snapshot.role !== 'HOST') return { ...snapshot, counts };
  return {
    ...snapshot,
    counts,
    roster: snapshot.roster.map((entry) =>
      entry.userId === presence.userId
        ? { ...entry, connected: presence.connected }
        : entry,
    ),
  };
}

/**
 * Socket.IO connection to one live session. The server is authoritative: the
 * hook only renders snapshots it receives. Every (re)connect fetches a fresh
 * short-lived ticket because the web and API run on different sites.
 */
export function useLiveSession(liveSessionId: string) {
  const [snapshot, setSnapshot] = useState<LiveSnapshotDto | null>(null);
  const [connection, setConnection] = useState<LiveConnection>('connecting');
  const [failure, setFailure] = useState<LiveFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  // True only after the server accepted session:join on the current socket.
  const joinedRef = useRef(false);
  // Bumped by a manual retry to start a fresh connection with reset counters.
  const [generation, setGeneration] = useState(0);

  useEffect(() => {
    let handshakeRetries = 0;
    let joinRetries = 0;
    let retryTimer: number | undefined;
    let joinTimer: number | undefined;
    let stopped = false;
    joinedRef.current = false;
    const socket = io(`${API_ORIGIN}${LIVE_SOCKET_NAMESPACE}`, {
      transports: ['websocket'],
      reconnectionDelayMax: 5_000,
      reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
      auth: (done) => {
        liveApi.socketTicket(liveSessionId).then(
          ({ ticket }) => done({ ticket }),
          (error: unknown) => {
            const problem = apiError(error);
            // Permanent refusals (not registered, removed) stop the loop.
            if ([403, 404].includes(problem.status)) {
              stopped = true;
              setFailure({ code: problem.code, message: problem.message });
              setConnection('failed');
            }
            done({});
          },
        );
      },
    });
    socketRef.current = socket;

    function fail(problem: LiveFailure | null) {
      stopped = true;
      joinedRef.current = false;
      window.clearTimeout(joinTimer);
      if (problem) setFailure(problem);
      setConnection((current) => (current === 'replaced' ? current : 'failed'));
      socket.disconnect();
    }

    async function join() {
      const ack = (await socket
        .timeout(10_000)
        .emitWithAck(LIVE_EVENTS.join, { liveSessionId })
        .catch(() => null)) as SocketAck<LiveSnapshotDto> | null;
      // Disconnected meanwhile: the next 'connect' joins again.
      if (!socket.connected || stopped) return;
      if (ack?.ok) {
        handshakeRetries = 0;
        joinRetries = 0;
        joinedRef.current = true;
        setAttempt(0);
        setFailure(null);
        setSnapshot(ack.data);
        setConnection('connected');
        return;
      }
      if (ack && PERMANENT_JOIN_ERRORS.has(ack.error.code)) {
        fail(ack.error);
        return;
      }
      // Timeout or temporary server problem (e.g. Redis or a busy row
      // lock): retry with backoff, then offer a manual retry.
      joinRetries += 1;
      setAttempt(Math.min(joinRetries, MAX_RECONNECT_ATTEMPTS));
      setConnection((current) =>
        current === 'connecting' ? current : 'reconnecting',
      );
      if (joinRetries >= MAX_RECONNECT_ATTEMPTS) {
        fail(null);
        return;
      }
      joinTimer = window.setTimeout(
        () => {
          if (socket.connected && !stopped) void join();
        },
        Math.min(joinRetries * 1_000, 5_000),
      );
    }

    socket.on('connect', () => {
      setAttempt(0);
      joinRetries = 0;
      void join();
    });
    socket.on(LIVE_EVENTS.removed, (removed: LiveRemovedDto) => fail(removed));
    socket.on(LIVE_EVENTS.snapshot, (next: LiveSnapshotDto) =>
      setSnapshot(next),
    );
    socket.on(LIVE_EVENTS.presence, (presence: LivePresenceDto) =>
      setSnapshot((current) => applyPresence(current, presence)),
    );
    socket.on(LIVE_EVENTS.replaced, () => setConnection('replaced'));
    socket.on('disconnect', (reason) => {
      joinedRef.current = false;
      window.clearTimeout(joinTimer);
      setConnection((current) =>
        current === 'replaced' || current === 'failed'
          ? current
          : reason === 'io client disconnect'
            ? current
            : 'reconnecting',
      );
    });
    socket.io.on('reconnect_attempt', (count) =>
      setAttempt(Math.min(count, MAX_RECONNECT_ATTEMPTS)),
    );
    socket.io.on('reconnect_failed', () =>
      setConnection((current) =>
        current === 'replaced' || current === 'failed' ? current : 'failed',
      ),
    );
    // A refused handshake (expired or missing ticket) is not retried by
    // Socket.IO itself; retry with a fresh ticket a few times.
    socket.on('connect_error', () => {
      if (socket.active || stopped) return;
      setConnection((current) =>
        current === 'failed' || current === 'replaced'
          ? current
          : 'reconnecting',
      );
      handshakeRetries += 1;
      setAttempt(Math.min(handshakeRetries, MAX_RECONNECT_ATTEMPTS));
      if (handshakeRetries >= MAX_RECONNECT_ATTEMPTS) {
        setConnection((current) =>
          current === 'replaced' ? current : 'failed',
        );
        return;
      }
      retryTimer = window.setTimeout(
        () => socket.connect(),
        Math.min(handshakeRetries * 1_000, 5_000),
      );
    });

    return () => {
      window.clearTimeout(retryTimer);
      window.clearTimeout(joinTimer);
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [liveSessionId, generation]);

  /** Sends a host command; the returned snapshot is applied on success. */
  const command = useCallback(
    async (event: string, extra: Record<string, unknown> = {}) => {
      const socket = socketRef.current;
      if (!socket?.connected)
        return {
          ok: false,
          error: {
            code: 'NOT_CONNECTED',
            message: 'You are offline. Wait for the connection to return.',
          },
        } as const;
      const ack = (await socket
        .timeout(10_000)
        .emitWithAck(event, { liveSessionId, ...extra })
        .catch(() => ({
          ok: false,
          error: {
            code: 'TIMEOUT',
            message: 'The live room did not respond. Please try again.',
          },
        }))) as SocketAck<LiveSnapshotDto>;
      if (ack.ok && ack.data) setSnapshot(ack.data);
      return ack;
    },
    [liveSessionId],
  );

  /**
   * Manual retry: replaces the socket so attempts start again from 1. Also
   * recovers a socket that is connected but never managed to join.
   */
  const reconnect = useCallback(() => {
    if (joinedRef.current) return;
    setFailure(null);
    setAttempt(0);
    setConnection('reconnecting');
    setGeneration((current) => current + 1);
  }, []);

  return { snapshot, connection, failure, attempt, command, reconnect };
}
