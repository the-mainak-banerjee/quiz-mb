export const HOUR_MS = 60 * 60 * 1000;
export const DAY_MS = 24 * HOUR_MS;

/**
 * When a rolling-window limit allows the next event: null when it already
 * does. `times` are the window's events, oldest first.
 */
export function windowReopens(times: Date[], limit: number, windowMs: number) {
  if (times.length < limit) return null;
  // The oldest event that must age out before one more fits.
  return new Date(times[times.length - limit]!.getTime() + windowMs);
}

/** Whole seconds from now until `time` (at least 1). */
export const secondsUntil = (time: Date) =>
  Math.max(1, Math.ceil((time.getTime() - Date.now()) / 1000));

/** "in 45 seconds", "in 12 minutes", "in 3 hours". */
export function waitText(seconds: number) {
  if (seconds < 60)
    return `in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60)
    return `in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.ceil(minutes / 60);
  return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}
