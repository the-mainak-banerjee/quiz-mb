import { API_PREFIX } from './routes.ts';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: Record<string, string>;
  readonly requestId: string | undefined;
  constructor(
    message: string,
    status = 0,
    code = 'NETWORK_ERROR',
    details: Record<string, string> = {},
    requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
  }
}

export function apiError(error: unknown): ApiError {
  return error instanceof ApiError
    ? error
    : new ApiError('Unable to connect. Please try again.');
}

type Options = {
  headers?: HeadersInit;
  signal?: AbortSignal;
  /** Only enable when authentication is checked before any mutation occurs. */
  authenticated?: boolean;
};
type Config = {
  baseUrl: string;
  headers?: HeadersInit;
  timeoutMs?: number;
  fetcher?: typeof fetch;
  /** Browser-only callback. Server clients must never rotate browser cookies. */
  refresh?: () => Promise<unknown>;
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
      throw new ApiError('Invalid API path.', 0, 'INVALID_REQUEST');
    const headers = new Headers(config.headers);
    new Headers(options.headers).forEach((value, name) =>
      headers.set(name, value),
    );
    headers.set('Accept', 'application/json');
    if (body !== undefined || !['GET', 'HEAD'].includes(method))
      headers.set('Content-Type', 'application/json');
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
            'INVALID_RESPONSE',
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
          throw new ApiError(
            response.status >= 500
              ? 'Service unavailable. Please try again.'
              : typeof error.message === 'string'
                ? error.message
                : 'Request failed. Please try again.',
            response.status,
            typeof error.code === 'string' ? error.code : 'REQUEST_FAILED',
            details,
            typeof error.requestId === 'string'
              ? error.requestId
              : (response.headers.get('X-Request-ID') ?? undefined),
          );
        }
        if (record(payload) && payload.success === true && 'data' in payload)
          return payload.data as T;
        if (record(payload) && 'success' in payload)
          throw new ApiError(
            'The server returned an invalid response.',
            response.status,
            'INVALID_RESPONSE',
          );
        // Health and other explicitly unenveloped JSON endpoints are supported.
        return payload as T;
      } catch (error) {
        if (error instanceof ApiError) throw error;
        if (options.signal?.aborted)
          throw new ApiError('Request cancelled.', 0, 'ABORTED');
        if (timeout.aborted)
          throw new ApiError(
            'Request timed out. Please try again.',
            0,
            'TIMEOUT',
          );
        throw apiError(error);
      }
    }
    try {
      return await send();
    } catch (error) {
      if (
        !(error instanceof ApiError) ||
        error.status !== 401 ||
        !options.authenticated ||
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
      return send();
    }
  }
  return {
    get: <T>(path: string, options?: Options) =>
      request<T>('GET', path, undefined, options),
    post: <T>(path: string, body: unknown = {}, options?: Options) =>
      request<T>('POST', path, body, options),
    put: <T>(path: string, body: unknown, options?: Options) =>
      request<T>('PUT', path, body, options),
    patch: <T>(path: string, body: unknown, options?: Options) =>
      request<T>('PATCH', path, body, options),
    delete: <T = void>(path: string, options?: Options) =>
      request<T>('DELETE', path, undefined, options),
  };
}
