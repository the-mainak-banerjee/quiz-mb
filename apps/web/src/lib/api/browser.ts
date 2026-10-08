import { ApiError, createApiClient } from './client';
import { API_ORIGIN } from './config';
import { API_ROUTES } from './routes';
import { APP_LINKS } from '@/config/navigation';
import {
  authLink,
  safeReturnTo,
  SESSION_ENDED_PARAM,
} from '@/lib/auth/return-to';

const transport = createApiClient({ baseUrl: API_ORIGIN });

let renewal: Promise<unknown> | undefined;
const renewedListeners = new Set<() => void>();

/** Runs after every successful renewal (e.g. to reschedule the next one). */
export function onSessionRenewed(listener: () => void) {
  renewedListeners.add(listener);
  return () => {
    renewedListeners.delete(listener);
  };
}

/**
 * The session cannot be renewed (the refresh token expired, or the sign-in
 * was ended elsewhere): sign in again and come back to this page.
 */
function sessionEnded() {
  const { pathname, search } = window.location;
  // On the renewal page, return to the page it was renewing for.
  const returnTo =
    pathname === APP_LINKS.AUTH.SESSION
      ? (new URLSearchParams(search).get('returnTo') ?? undefined)
      : `${pathname}${search}`;
  // A full load: nothing of the ended session stays in memory.
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign(
    `${authLink(APP_LINKS.AUTH.LOGIN, safeReturnTo(returnTo))}&${SESSION_ENDED_PARAM}=1`,
  );
}

// Every tab shares the auth cookies, so a renewal by one tab renews all of
// them. The API treats a reused refresh token as theft and ends the sign-in,
// so tabs must never renew with the same token: one renews at a time (a Web
// Lock), and a tab that finds a renewal just done skips its own.
const RENEWAL_LOCK = 'quizmb-session-renewal';
const RENEWED_AT_KEY = 'quizmb-session-renewed-at';
/** A renewal this recent (by any tab) means the cookies are already fresh. */
const RECENT_RENEWAL_MS = 30_000;

function renewedAt() {
  try {
    return Number(window.localStorage.getItem(RENEWED_AT_KEY)) || 0;
  } catch {
    return 0;
  }
}
function markRenewed() {
  try {
    window.localStorage.setItem(RENEWED_AT_KEY, String(Date.now()));
  } catch {
    // Storage unavailable: tabs still take turns through the lock.
  }
}
function notifyRenewed() {
  for (const listener of renewedListeners) listener();
}
// Another tab renewed: this tab's schedule starts over too.
if (typeof window !== 'undefined')
  window.addEventListener('storage', (event) => {
    if (event.key === RENEWED_AT_KEY) notifyRenewed();
  });

function oneTabAtATime<T>(task: () => Promise<T>): Promise<T> {
  return typeof navigator !== 'undefined' && navigator.locks
    ? (navigator.locks.request(RENEWAL_LOCK, task) as Promise<T>)
    : task();
}

/**
 * Renews the access token with the refresh cookie, which only the API
 * receives. Concurrent callers share one renewal, and tabs take turns (see
 * above). A refused renewal ends the session.
 */
export function refreshSession() {
  renewal ??= oneTabAtATime(async () => {
    if (Date.now() - renewedAt() < RECENT_RENEWAL_MS) return;
    await transport.post(API_ROUTES.AUTH.REFRESH);
    markRenewed();
  })
    .then(
      () => notifyRenewed(),
      (error: unknown) => {
        if (error instanceof ApiError && error.status === 401) sessionEnded();
        throw error;
      },
    )
    .finally(() => {
      renewal = undefined;
    });
  return renewal;
}

/** Use for every browser API call, including future product features. */
export const api = createApiClient({
  baseUrl: API_ORIGIN,
  refresh: refreshSession,
});
