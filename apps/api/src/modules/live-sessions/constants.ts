import { LIVE_EVENTS } from '@quizmb/contracts';

// Socket.IO room names for live sessions. Host and participant sockets join
// different audience rooms so role-specific payloads reach only their role.
export const ROOM_AUDIENCE = {
  HOST: 'host',
  PARTICIPANTS: 'participants',
} as const;
type RoomAudience = (typeof ROOM_AUDIENCE)[keyof typeof ROOM_AUDIENCE];

/** `/quiz` namespace room: the whole session, or one audience within it. */
export const liveRoom = (liveSessionId: string, audience?: RoomAudience) =>
  audience ? `quiz:${liveSessionId}:${audience}` : `quiz:${liveSessionId}`;

/** `/quiz-status` namespace room: watchers of one quiz's lifecycle. */
export const statusRoom = (quizId: string) => `status:${quizId}`;

/**
 * Room (in every namespace) of the sockets opened with one sign-in session
 * family; revoking the family (logout, token replay) disconnects them.
 */
export const authFamilyRoom = (familyId: string) => `auth-family:${familyId}`;

/**
 * How long the host may be disconnected before participants are told; a
 * page refresh or brief network drop stays invisible to them.
 */
export const HOST_AWAY_GRACE_MS = 5_000;

/**
 * Live commands one account may send per session and window (security
 * design 1.10), counted across all its sockets in that session.
 */
export const SOCKET_RATE_WINDOW_MS = 60_000;
export const SOCKET_RATE_LIMITS = {
  join: 20,
  sync: 30,
  /** Answer submissions, resends included. */
  answer: 10,
  host: 60,
} as const;
/** A connection with this many refused commands in a window is closed. */
export const SOCKET_FLOOD_REFUSALS = 30;
/** Largest incoming socket message (Socket.IO `maxHttpBufferSize`). */
export const SOCKET_MAX_MESSAGE_BYTES = 16 * 1024;
export type SocketRateBucket = keyof typeof SOCKET_RATE_LIMITS;

/** Which budget each limited command draws from (others are unlimited). */
export const SOCKET_RATE_BUCKET: Partial<Record<string, SocketRateBucket>> = {
  [LIVE_EVENTS.join]: 'join',
  [LIVE_EVENTS.sync]: 'sync',
  [LIVE_EVENTS.answerSubmit]: 'answer',
  [LIVE_EVENTS.quizStart]: 'host',
  [LIVE_EVENTS.questionStart]: 'host',
  [LIVE_EVENTS.lateJoinSet]: 'host',
  [LIVE_EVENTS.leaderboardGet]: 'host',
  [LIVE_EVENTS.leaderboardShow]: 'host',
  [LIVE_EVENTS.leaderboardHide]: 'host',
  [LIVE_EVENTS.quizEnd]: 'host',
  [LIVE_EVENTS.finalLeaderboardShow]: 'host',
  [LIVE_EVENTS.lobbyClose]: 'host',
  [LIVE_EVENTS.sessionClose]: 'host',
};

/** Socket.IO's own lifecycle events (not part of our contract). */
export const SOCKET_EVENT = { DISCONNECT: 'disconnect' } as const;

// Socket ticket kinds: each has its own JWT audience and resource claim.
export const TICKET_KIND = { LIVE: 'live', WATCH: 'watch' } as const;

// Redis key layout (DATABASE_REDIS_SOCKET_DESIGN §39–§54):
//   lq:{liveSessionId}:presence   HASH participant userId → active socket id
//   lock:{operation}:{resourceId} STRING random owner token (short TTL)
export const presenceKey = (liveSessionId: string) =>
  `lq:${liveSessionId}:presence`;
/**
 * Server-side scoring (PRD §23): a correct answer earns up to MAX_POINTS,
 * decreasing linearly with response time by up to SPEED_WEIGHT of it.
 * Not configurable in the MVP UI.
 */
export const SCORING = {
  MAX_POINTS: 1000,
  SPEED_WEIGHT: 0.6,
} as const;

/** Operations serialized with `LiveStore.withLock`. */
export const LOCK_OPERATION = {
  SESSION_TRANSITION: 'session-transition',
} as const;

export const lockKey = (operation: string, resourceId: string) =>
  `lock:${operation}:${resourceId}`;
