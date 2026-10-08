import {
  CONTENT_TYPE,
  ERROR_CODE,
  HTTP_HEADER,
  HTTP_METHOD,
} from '@quizmb/contracts';
import { CLIENT_ERROR_CODE } from './error-codes.ts';
import { API_PREFIX } from './routes.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, string>;
  readonly requestId: string | undefined;
  /** Seconds the server asked to wait (`Retry-After`), when it did. */
  readonly retryAfterSeconds: number | undefined;
  constructor(
    message: string,
    status = 0,
    code: string = CLIENT_ERROR_CODE.NETWORK_ERROR,
    details: Record<string, string> = {},
    requestId?: string,
    retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** "in 45 seconds", "in 3 minutes" or "shortly" for a Retry-After value. */
export function retryWait(seconds: number | undefined) {
  if (!seconds) return 'shortly';
  if (seconds < 60)
    return `in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
  const minutes = Math.ceil(seconds / 60);
  return `in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

/**
 * Unavailable answers whose message is written for people (a paused feature
 * or full image storage); other 5xx messages are replaced by a generic one.
 */
const SHOWN_UNAVAILABLE_CODES = new Set<string>([
  ERROR_CODE.FEATURE_PAUSED,
  ERROR_CODE.STORAGE_UNAVAILABLE,
]);

/** Automatic retries of a SERVICE_BUSY answer (nothing was changed). */
const BUSY_RETRIES = 2;
/** Longest wait before a busy retry, whatever Retry-After says. */
const BUSY_MAX_WAIT_SECONDS = 5;

export function apiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError('Unable to connect. Please try again.');
}

const BODYLESS_METHODS: readonly string[] = [HTTP_METHOD.GET, HTTP_METHOD.HEAD];

type Options = {
  headers?: HeadersInit;
  signal?: AbortSignal;
  /**
   * Renew and retry on any 401 (also for a missing access token). Only
   * enable when authentication is checked before any mutation occurs. An
   * expired access token (TOKEN_EXPIRED) is renewed and retried either way.
   */
  authenticated?: boolean;
  /** Called before each automatic retry of a busy server, e.g. for a label. */
  onBusyRetry?: () => void;
};
type Config = {
  baseUrl: string;
  headers?: HeadersInit;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  /** Browser-only callback. Server clients must never rotate browser cookies. */
  refresh?: () => Promise<unknown>;
  /** Waits before a busy retry; tests replace it. */
  sleep?: (ms: number) => Promise<void>;
};
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** JSON API factory shared by browser callers and request-scoped server clients. */
export function createApiClient(config: Config) {
  const base = new URL(config.baseUrl);
  if (
    !['http:', 'https:'].includes(base.protocol) ||
    base.origin !== config.baseUrl
  )
    throw new Error('API base URL must be an HTTP(S) origin');
  const fetcher = config.fetcher ?? fetch;
  let refreshing: Promise<unknown> | undefined;
  let generation = 0;
  async function request<T>(
    method: string,
    path: string,
    body: unknown,
    options: Options = {},
  ): Promise<T> {
    // Never send cookies or server authorization headers to caller-supplied origins.
    const url = new URL(path, base);
    if (
      !path.startsWith(`${API_PREFIX}/`) ||
      url.origin !== base.origin ||
      !url.pathname.startsWith(`${API_PREFIX}/`)
    )
      throw new ApiError(
        'Invalid API path.',
        0,
        CLIENT_ERROR_CODE.INVALID_REQUEST,
      );
    const headers = new Headers(config.headers);
    new Headers(options.headers).forEach((value, name) =>
      headers.set(name, value),
    );
    headers.set(HTTP_HEADER.ACCEPT, CONTENT_TYPE.JSON);
    if (body !== undefined || !BODYLESS_METHODS.includes(method))
      headers.set(HTTP_HEADER.CONTENT_TYPE, CONTENT_TYPE.JSON);
    const encoded = body === undefined ? undefined : JSON.stringify(body);
    const startedGeneration = generation;
    async function send(): Promise<T> {
      const timeout = AbortSignal.timeout(config.timeoutMs ?? 15000);
      const signal = options.signal
        ? AbortSignal.any([options.signal, timeout])
        : timeout;
      try {
        const response = await fetcher(url, {
          method,
          headers,
          body: encoded ?? null,
          signal,
          credentials: 'include',
          cache: 'no-store',
          redirect: 'error',
        });
        if (response.status === 204 && response.ok) return undefined as T;
        let payload: unknown;
        try {
          payload = await response.json();
        } catch {
          if (signal.aborted) throw signal.reason;
          throw new ApiError(
            'The server returned an invalid response.',
            response.status,
            CLIENT_ERROR_CODE.INVALID_RESPONSE,
          );
        }
        if (!response.ok || (record(payload) && payload.success === false)) {
          const error =
            record(payload) && record(payload.error) ? payload.error : {};
          const details = record(error.details)
            ? Object.fromEntries(
                Object.entries(error.details).filter(
                  (entry): entry is [string, string] =>
                    typeof entry[1] === 'string',
                ),
              )
            : {};
          const code =
            typeof error.code === 'string'
              ? error.code
              : CLIENT_ERROR_CODE.REQUEST_FAILED;
          const retryAfter = Number(
            response.headers.get(HTTP_HEADER.RETRY_AFTER),
          );
          const retryAfterSeconds =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.ceil(retryAfter)
              : undefined;
          throw new ApiError(
            code === ERROR_CODE.RATE_LIMITED
              ? `Too many attempts. Try again ${retryWait(retryAfterSeconds)}.`
              : code === ERROR_CODE.SERVICE_BUSY
                ? 'The server is busy right now. Please try again in a moment.'
                : response.status >= 500 && !SHOWN_UNAVAILABLE_CODES.has(code)
                  ? 'Service unavailable. Please try again.'
                  : typeof error.message === 'string'
                    ? error.message
                    : 'Request failed. Please try again.',
            response.status,
            code,
            details,
            typeof error.requestId === 'string'
              ? error.requestId
              : (response.headers.get(HTTP_HEADER.REQUEST_ID) ?? undefined),
            retryAfterSeconds,
          );
        }
        if (record(payload) && payload.success === true && 'data' in payload)
          return payload.data as T;
        if (record(payload) && 'success' in payload)
          throw new ApiError(
            'The server returned an invalid response.',
            response.status,
            CLIENT_ERROR_CODE.INVALID_RESPONSE,
          );
        // Health and other explicitly unenveloped JSON endpoints are supported.
        return payload as T;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (options.signal?.aborted)
          throw new ApiError(
            'Request cancelled.',
            0,
            CLIENT_ERROR_CODE.ABORTED,
          );
        if (timeout.aborted)
          throw new ApiError(
            'Request timed out. Please try again.',
            0,
            CLIENT_ERROR_CODE.TIMEOUT,
          );
        throw apiError(error);
      }
    }
    const sleep =
      config.sleep ??
      ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
    /** A busy server changed nothing, so the request is safe to repeat. */
    async function sendWhenFree(): Promise<T> {
      for (let retry = 0; ; retry++) {
        try {
          return await send();
        } catch (error) {
          if (
            !(error instanceof ApiError) ||
            error.code !== ERROR_CODE.SERVICE_BUSY ||
            retry >= BUSY_RETRIES ||
            options.signal?.aborted
          )
            throw error;
          options.onBusyRetry?.();
          await sleep(
            Math.min(error.retryAfterSeconds ?? 1, BUSY_MAX_WAIT_SECONDS) *
              1000,
          );
        }
      }
    }
    try {
      return await sendWhenFree();
    } catch (error) {
      // An expired access token is always renewed and retried: the API
      // checks the token before doing anything, so nothing was changed.
      if (
        !(error instanceof ApiError) ||
        error.status !== 401 ||
        !(options.authenticated || error.code === ERROR_CODE.TOKEN_EXPIRED) ||
        !config.refresh ||
        options.signal?.aborted
      )
        throw error;
      // Late 401 responses from the same generation also reuse the renewal.
      if (generation === startedGeneration) {
        refreshing ??= Promise.resolve()
          .then(config.refresh)
          .then(() => {
            generation++;
          })
          .finally(() => {
            refreshing = undefined;
          });
        await refreshing;
      }
      // Exactly one retry; never retry network failures or arbitrary mutations.
      return sendWhenFree();
    }
  }
  return {
    get: <T>(path: string, options?: Options) =>
      request<T>(HTTP_METHOD.GET, path, undefined, options),
    post: <T>(path: string, body: unknown = {}, options?: Options) =>
      request<T>(HTTP_METHOD.POST, path, body, options),
    put: <T>(path: string, body: unknown, options?: Options) =>
      request<T>(HTTP_METHOD.PUT, path, body, options),
    patch: <T>(path: string, body: unknown, options?: Options) =>
      request<T>(HTTP_METHOD.PATCH, path, body, options),
    delete: <T = void>(path: string, options?: Options) =>
      request<T>(HTTP_METHOD.DELETE, path, undefined, options),
  };
}
