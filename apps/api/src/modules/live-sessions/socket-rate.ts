import {
  SOCKET_RATE_LIMITS,
  SOCKET_RATE_WINDOW_MS,
  type SocketRateBucket,
} from './constants.js';

type Window = { startedAt: number; count: number };

/**
 * Fixed-window command budgets per account and live session (security
 * design 1.10), shared by all of that account's sockets in the session, so
 * reconnecting never resets them. Kept in memory: a session's sockets talk
 * to one API process, so this is exact and costs no Redis commands; opening
 * more sockets needs a Redis-limited ticket. `firstRefusal` marks the first
 * command refused in a window, so a flood is logged once rather than once
 * per command. Idle keys are swept as the map is used.
 */
export function socketRateLimiter(now: () => number = Date.now) {
  const budgets = new Map<string, Map<SocketRateBucket, Window>>();
  let lastSweepAt = now();
  return (key: string, bucket: SocketRateBucket) => {
    const time = now();
    if (time - lastSweepAt >= SOCKET_RATE_WINDOW_MS) {
      lastSweepAt = time;
      for (const [entry, windows] of budgets)
        if (
          [...windows.values()].every(
            (window) => time - window.startedAt >= SOCKET_RATE_WINDOW_MS,
          )
        )
          budgets.delete(entry);
    }
    let windows = budgets.get(key);
    if (!windows) {
      windows = new Map();
      budgets.set(key, windows);
    }
    let window = windows.get(bucket);
    if (!window || time - window.startedAt >= SOCKET_RATE_WINDOW_MS) {
      window = { startedAt: time, count: 0 };
      windows.set(bucket, window);
    }
    window.count += 1;
    const limit = SOCKET_RATE_LIMITS[bucket];
    return {
      allowed: window.count <= limit,
      firstRefusal: window.count === limit + 1,
    };
  };
}

/**
 * Refused commands of one connection in the current window: true once it
 * reaches SOCKET_FLOOD_REFUSALS, when the connection should be closed.
 */
export function floodCounter(limit: number, now: () => number = Date.now) {
  let window: Window = { startedAt: now(), count: 0 };
  return () => {
    const time = now();
    if (time - window.startedAt >= SOCKET_RATE_WINDOW_MS)
      window = { startedAt: time, count: 0 };
    window.count += 1;
    return window.count >= limit;
  };
}
