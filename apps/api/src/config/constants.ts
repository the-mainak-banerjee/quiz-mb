// API-only constants. Values shared with the web app live in
// `@quizmb/contracts` (constants.ts); keep this file for server concerns.

/** Reported as `service` on every log line. */
export const SERVICE_NAME = 'quizmb-api';

/** JWT `iss` claim for access tokens and socket tickets. */
export const TOKEN_ISSUER = 'quizmb-api';

/** Prefix of the `Authorization` header value for bearer access tokens. */
export const BEARER_PREFIX = /^Bearer /;

export const NODE_ENV = {
  DEVELOPMENT: 'development',
  TEST: 'test',
  PRODUCTION: 'production',
} as const;

/** `Cache-Control` value for responses that must never be stored. */
export const CACHE_NO_STORE = 'no-store';
