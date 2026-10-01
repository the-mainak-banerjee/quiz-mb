import { randomUUID } from 'node:crypto';
import type { RedisClient } from '../../infrastructure/redis.js';
import { ApiError } from '../../http/api-error.js';
import { ERROR_CODE } from '@quizmb/contracts';
import { lockKey, presenceKey } from './constants.js';

// Key layout: see ./constants.ts. The presence hash doubles as the "one active device" record: the newest
// socket id per user wins. Only accepted join/leave events write here — no
// heartbeats or polling — to keep Upstash free-tier command usage low.

const ACTIVE_TTL_SECONDS = 24 * 60 * 60;
const COMPLETED_TTL_SECONDS = 6 * 60 * 60;
const LOCK_TTL_MS = 10_000;

// Atomically record the newest socket for a user and return the replaced one.
const CLAIM_SCRIPT = `
local previous = redis.call('HGET', KEYS[1], ARGV[1])
redis.call('HSET', KEYS[1], ARGV[1], ARGV[2])
redis.call('EXPIRE', KEYS[1], ARGV[3])
return previous`;

// Remove presence only if this socket is still the user's active one, so a
// replaced device disconnecting never removes its successor.
const RELEASE_SCRIPT = `
if redis.call('HGET', KEYS[1], ARGV[1]) == ARGV[2] then
  redis.call('HDEL', KEYS[1], ARGV[1])
  return 1
end
return 0`;

// Remove a user's presence whatever socket holds it; returns that socket.
const EVICT_SCRIPT = `
local socket = redis.call('HGET', KEYS[1], ARGV[1])
redis.call('HDEL', KEYS[1], ARGV[1])
return socket`;

const UNLOCK_SCRIPT = `
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
end
return 0`;

function unavailable(): never {
  throw new ApiError(
    503,
    ERROR_CODE.LIVE_UNAVAILABLE,
    'The live room is temporarily unavailable. Please try again.',
  );
}

async function guard<T>(operation: Promise<T>): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    return unavailable();
  }
}

export class LiveStore {
  constructor(private redis: RedisClient) {}

  /** Returns the socket id this claim replaced, if any. */
  async claimPresence(liveSessionId: string, userId: string, socketId: string) {
    const previous = await guard(
      this.redis.eval(
        CLAIM_SCRIPT,
        1,
        presenceKey(liveSessionId),
        userId,
        socketId,
        String(ACTIVE_TTL_SECONDS),
      ),
    );
    return typeof previous === 'string' && previous !== socketId
      ? previous
      : null;
  }

  /** True when the socket was the active one and presence was removed. */
  async releasePresence(
    liveSessionId: string,
    userId: string,
    socketId: string,
  ) {
    const removed = await guard(
      this.redis.eval(
        RELEASE_SCRIPT,
        1,
        presenceKey(liveSessionId),
        userId,
        socketId,
      ),
    );
    return removed === 1;
  }

  /** Removes the user's presence; returns the socket that held it. */
  async evictPresence(liveSessionId: string, userId: string) {
    const socket = await guard(
      this.redis.eval(EVICT_SCRIPT, 1, presenceKey(liveSessionId), userId),
    );
    return typeof socket === 'string' ? socket : null;
  }

  async activeSocket(liveSessionId: string, userId: string) {
    return guard(this.redis.hget(presenceKey(liveSessionId), userId));
  }

  async connectedCount(liveSessionId: string) {
    return guard(this.redis.hlen(presenceKey(liveSessionId)));
  }

  async connectedUserIds(liveSessionId: string) {
    return new Set(await guard(this.redis.hkeys(presenceKey(liveSessionId))));
  }

  /** Drops all presence for a session that no longer exists. */
  async clearPresence(liveSessionId: string) {
    await guard(this.redis.del(presenceKey(liveSessionId)));
  }

  /** Keep completed-session presence briefly for recovery, then expire it. */
  async expireCompleted(liveSessionId: string) {
    await guard(
      this.redis.expire(presenceKey(liveSessionId), COMPLETED_TTL_SECONDS),
    );
  }

  /**
   * Short owner-checked lock around lifecycle transitions. PostgreSQL row
   * locks and constraints remain the durable integrity layer.
   */
  async withLock<T>(
    operation: string,
    resourceId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    const key = lockKey(operation, resourceId);
    const token = randomUUID();
    const acquired = await guard(
      this.redis.set(key, token, 'PX', LOCK_TTL_MS, 'NX'),
    );
    if (acquired !== 'OK')
      throw new ApiError(
        409,
        ERROR_CODE.OPERATION_IN_PROGRESS,
        'Another update to this live session is in progress. Try again.',
      );
    try {
      return await work();
    } finally {
      await this.redis.eval(UNLOCK_SCRIPT, 1, key, token).catch(() => {});
    }
  }
}
