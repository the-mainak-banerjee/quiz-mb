'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import {
  LIVE_EVENTS,
  LIVE_SOCKET_NAMESPACE,
  type HostQuestionProgressDto,
  type LiveCountDto,
  type LiveHostPresenceDto,
  type LivePresenceDto,
  type LiveRemovedDto,
  type LiveSnapshotDto,
  type ParticipantAnswerDto,
  type ParticipantFinalResultDto,
  type ParticipantStandingDto,
  type SocketAck,
  ERROR_CODE,
  LIVE_ROLE,
} from '@quizmb/contracts';
import { API_ORIGIN } from '@/lib/api/config';
import { apiError } from '@/lib/api/client';
import { liveApi } from '@/lib/api/live';
import { CLIENT_ERROR_CODE } from '@/lib/api/error-codes';

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
const PERMANENT_JOIN_ERRORS = new Set<string>([
  ERROR_CODE.REGISTRATION_REQUIRED,
  ERROR_CODE.LATE_JOIN_DISABLED,
  ERROR_CODE.QUIZ_COMPLETED,
  ERROR_CODE.SESSION_NOT_FOUND,
  ERROR_CODE.FORBIDDEN,
  ERROR_CODE.VALIDATION_ERROR,
]);

function applyPresence(
  snapshot: LiveSnapshotDto | null,
  presence: LivePresenceDto,
): LiveSnapshotDto | null {
  if (!snapshot) return snapshot;
  const counts = { ...snapshot.counts, connected: presence.connectedCount };
  if (snapshot.role !== LIVE_ROLE.HOST) return { ...snapshot, counts };
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

/** Merges throttled host progress into the current question. */
function applyProgress(
  snapshot: LiveSnapshotDto | null,
  progress: HostQuestionProgressDto,
): LiveSnapshotDto | null {
  if (
    snapshot?.role !== LIVE_ROLE.HOST ||
    snapshot.currentQuestion?.askedQuestionId !== progress.askedQuestionId
  )
    return snapshot;
  return {
    ...snapshot,
    currentQuestion: { ...snapshot.currentQuestion, ...progress },
  };
}

const notConnected = {
  ok: false,
  error: {
    code: CLIENT_ERROR_CODE.NOT_CONNECTED,
    message: 'You are offline. Wait for the connection to return.',
  },
} as const;

const timedOut = {
  ok: false,
  error: {
    code: CLIENT_ERROR_CODE.TIMEOUT,
    message: 'The live room did not respond. Please try again.',
  },
} as const;

/** Wait before repeating a sync refused for exceeding its budget. */
const SYNC_RETRY_MS = 2_000;

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
  /** This participant's own answer; only ever sent to them. */
  const [myAnswer, setMyAnswer] = useState<ParticipantAnswerDto | null>(null);
  /** The asked question this participant entered while it was running. */
  const [lateJoinQuestionId, setLateJoinQuestionId] = useState<string | null>(
    null,
  );
  /** Score and rank after the latest ended question (personal). */
  const [myStanding, setMyStanding] = useState<ParticipantStandingDto | null>(
    null,
  );
  /** This participant's final result, sent once when the quiz ends. */
  const [finalResult, setFinalResult] =
    useState<ParticipantFinalResultDto | null>(null);
  /**
   * Server clock minus browser clock, measured from join and sync replies
   * (half the round trip corrects for latency). Broadcasts and host command
   * replies do not move it: their delivery or processing delay is unknown.
   */
  const [clockOffsetMs, setClockOffsetMs] = useState(0);
  const socketRef = useRef<Socket | null>(null);
  // True only after the server accepted session:join on the current socket.
  const joinedRef = useRef(false);
  // Bumped by a manual retry to start a fresh connection with reset counters.
  const [generation, setGeneration] = useState(0);

  /**
   * Applies a snapshot. Personal fields arrive only in snapshots addressed
   * to this participant; broadcasts omit them, so they are kept as they are.
   * `sentAt` is when the request this snapshot acknowledges was sent.
   */
  const receive = useCallback((next: LiveSnapshotDto, sentAt?: number) => {
    setSnapshot(next);
    if (sentAt !== undefined)
      setClockOffsetMs(Date.parse(next.serverTime) - (sentAt + Date.now()) / 2);
    if (next.role !== LIVE_ROLE.PARTICIPANT) return;
    if ('myAnswer' in next) setMyAnswer(next.myAnswer ?? null);
    // Tied to the question it describes, so it never carries over.
    if (next.joinedDuringQuestion !== undefined)
      setLateJoinQuestionId(
        next.joinedDuringQuestion
          ? (next.question?.askedQuestionId ?? null)
          : null,
      );
    if ('myStanding' in next) setMyStanding(next.myStanding ?? null);
  }, []);

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
      const sentAt = Date.now();
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
        receive(ack.data, sentAt);
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
    socket.on(LIVE_EVENTS.snapshot, (next: LiveSnapshotDto) => receive(next));
    socket.on(LIVE_EVENTS.standing, setMyStanding);
    socket.on(LIVE_EVENTS.quizEnded, setFinalResult);
    socket.on(LIVE_EVENTS.submissions, (progress: HostQuestionProgressDto) =>
      setSnapshot((current) => applyProgress(current, progress)),
    );
    socket.on(LIVE_EVENTS.presence, (presence: LivePresenceDto) =>
      setSnapshot((current) => applyPresence(current, presence)),
    );
    socket.on(LIVE_EVENTS.count, ({ connectedCount }: LiveCountDto) =>
      setSnapshot((current) =>
        current
          ? {
              ...current,
              counts: { ...current.counts, connected: connectedCount },
            }
          : current,
      ),
    );
    socket.on(
      LIVE_EVENTS.hostPresence,
      ({ hostConnected }: LiveHostPresenceDto) =>
        setSnapshot((current) =>
          current?.role === LIVE_ROLE.PARTICIPANT
            ? { ...current, hostConnected }
            : current,
        ),
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
  }, [liveSessionId, generation, receive]);

  /** Sends a host command; the returned snapshot is applied on success. */
  const command = useCallback(
    async (event: string, extra: Record<string, unknown> = {}) => {
      const socket = socketRef.current;
      if (!socket?.connected) return notConnected;
      const ack = (await socket
        .timeout(10_000)
        .emitWithAck(event, { liveSessionId, ...extra })
        .catch(() => timedOut)) as SocketAck<LiveSnapshotDto>;
      if (ack.ok && ack.data) receive(ack.data);
      return ack;
    },
    [liveSessionId, receive],
  );

  /** A read-only request whose reply is not a snapshot (e.g. leaderboard). */
  const query = useCallback(
    async <T>(event: string) => {
      const socket = socketRef.current;
      if (!socket?.connected) return notConnected;
      return (await socket
        .timeout(10_000)
        .emitWithAck(event, { liveSessionId })
        .catch(() => timedOut)) as SocketAck<T>;
    },
    [liveSessionId],
  );

  /** Submits this participant's answer; the server locks it on success. */
  const submitAnswer = useCallback(
    async (
      askedQuestionId: string,
      answer: { selectedOptionIds?: string[]; answerText?: string },
    ) => {
      const socket = socketRef.current;
      if (!socket?.connected) return notConnected;
      const ack = (await socket
        .timeout(10_000)
        .emitWithAck(LIVE_EVENTS.answerSubmit, {
          liveSessionId,
          askedQuestionId,
          ...answer,
        })
        .catch(() => timedOut)) as SocketAck<ParticipantAnswerDto>;
      if (ack.ok) setMyAnswer(ack.data);
      return ack;
    },
    [liveSessionId],
  );

  /**
   * Asks the server for the current state, e.g. when the local countdown
   * reaches zero; this also closes an overdue question on the server. A sync
   * refused for exceeding its budget is tried once more after a pause.
   */
  const resync = useCallback(async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      const socket = socketRef.current;
      if (!socket?.connected || !joinedRef.current) return;
      const sentAt = Date.now();
      const ack = (await socket
        .timeout(10_000)
        .emitWithAck(LIVE_EVENTS.sync, { liveSessionId })
        .catch(() => null)) as SocketAck<LiveSnapshotDto> | null;
      if (ack?.ok) {
        receive(ack.data, sentAt);
        return;
      }
      if (ack?.error.code !== ERROR_CODE.RATE_LIMITED) return;
      await new Promise((resolve) => window.setTimeout(resolve, SYNC_RETRY_MS));
    }
  }, [liveSessionId, receive]);

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

  return {
    snapshot,
    connection,
    failure,
    attempt,
    command,
    query,
    reconnect,
    myAnswer,
    myStanding,
    finalResult,
    lateJoinQuestionId,
    clockOffsetMs,
    submitAnswer,
    resync,
  };
}
