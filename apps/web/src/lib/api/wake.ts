import { API_ORIGIN } from './config';
import { API_ROUTES } from './routes';

/**
 * The API runs on hosting that sleeps when idle; the first request after a
 * pause waits while it starts (30–60 s). Requests a person waits on at the
 * start of a visit (sign-in, sign-up, verification, session renewal) get
 * this long to answer instead of the usual 15 s.
 */
export const COLD_START_TIMEOUT_MS = 75_000;

let woken = false;

/**
 * Starts waking the API in the background, once per page load, so it is
 * likely awake by the time someone submits a form. The answer is not read
 * (`no-cors`), and a failure is ignored: real requests report their own.
 */
export function wakeApi() {
  if (woken) return;
  woken = true;
  void fetch(`${API_ORIGIN}${API_ROUTES.HEALTH}`, {
    mode: 'no-cors',
    cache: 'no-store',
    credentials: 'omit',
    keepalive: true,
  }).catch(() => {});
}
