/**
 * Error codes produced by the browser client itself (the request never got a
 * usable server answer). Server codes live in `ERROR_CODE` (@quizmb/contracts).
 */
export const CLIENT_ERROR_CODE = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  INVALID_REQUEST: 'INVALID_REQUEST',
  REQUEST_FAILED: 'REQUEST_FAILED',
  TIMEOUT: 'TIMEOUT',
  ABORTED: 'ABORTED',
  NOT_CONNECTED: 'NOT_CONNECTED',
} as const;
