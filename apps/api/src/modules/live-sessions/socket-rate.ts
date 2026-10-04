import {
  SOCKET_RATE_LIMITS,
  SOCKET_RATE_WINDOW_MS,
  type SocketRateBucket,
} from './constants.js';

/**
 * Fixed-window command budgets for one socket, kept in memory for the
 * socket's lifetime. Returns true while the command is within its budget.
 */
export function socketRateLimiter(now: () => number = Date.now) {
  const windows = new Map<
    SocketRateBucket,
    { startedAt: number; count: number }
  >();
  return (bucket: SocketRateBucket) => {
    const time = now();
    let window = windows.get(bucket);
    if (!window || time - window.startedAt >= SOCKET_RATE_WINDOW_MS) {
      window = { startedAt: time, count: 0 };
      windows.set(bucket, window);
    }
    window.count += 1;
    return window.count <= SOCKET_RATE_LIMITS[bucket];
  };
}
