import { createApiClient } from './client';
import { API_ORIGIN } from './config';
import { API_ROUTES } from './routes';

const transport = createApiClient({ baseUrl: API_ORIGIN });

let renewal: Promise<unknown> | undefined;

export function refreshSession() {
  renewal ??= transport.post(API_ROUTES.AUTH.REFRESH).finally(() => {
    renewal = undefined;
  });
  return renewal;
}

/** Use for every browser API call, including future product features. */
export const api = createApiClient({
  baseUrl: API_ORIGIN,
  refresh: refreshSession,
});
