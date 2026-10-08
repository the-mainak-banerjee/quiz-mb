/**
 * Values of the `alert` field on log lines that need attention (security
 * design 1.11). There is no alerting service: Render's log search, or any
 * log drain, alerts on `"alert":"<VALUE>"`. Each line carries ids and codes
 * only, never secrets or what a user sent, and is throttled where it fires
 * so a flood produces one line per window, not one per request.
 */
export const ALERT = {
  /** A socket command a non-host (or another session's ticket) sent. */
  LIVE_COMMAND_FORBIDDEN: 'LIVE_COMMAND_FORBIDDEN',
  /** A REST rate limit was first exceeded in its window. */
  RATE_LIMITED: 'RATE_LIMITED',
  /** A live command budget was first exceeded in its window. */
  LIVE_RATE_LIMITED: 'LIVE_RATE_LIMITED',
  /** A live connection kept flooding and was closed. */
  SOCKET_FLOOD: 'SOCKET_FLOOD',
  /** An account limit or allowance refused a request. */
  QUOTA_REFUSED: 'QUOTA_REFUSED',
  /** Platform media storage passed its warning level (600 MB). */
  STORAGE_HIGH: 'STORAGE_HIGH',
  /** Platform media storage is full (800 MB): uploads are paused. */
  STORAGE_FULL: 'STORAGE_FULL',
  /** The daily email budget passed 80% (warning) or 90% (refusing). */
  EMAIL_BUDGET: 'EMAIL_BUDGET',
} as const;
