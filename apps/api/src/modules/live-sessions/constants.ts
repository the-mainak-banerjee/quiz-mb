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

/** Socket.IO's own lifecycle events (not part of our contract). */
export const SOCKET_EVENT = { DISCONNECT: 'disconnect' } as const;

// Socket ticket kinds: each has its own JWT audience and resource claim.
export const TICKET_KIND = { LIVE: 'live', WATCH: 'watch' } as const;

// Redis key layout (DATABASE_REDIS_SOCKET_DESIGN §39–§54):
//   lq:{liveSessionId}:presence   HASH participant userId → active socket id
//   lock:{operation}:{resourceId} STRING random owner token (short TTL)
export const presenceKey = (liveSessionId: string) =>
  `lq:${liveSessionId}:presence`;
export const lockKey = (operation: string, resourceId: string) =>
  `lock:${operation}:${resourceId}`;
