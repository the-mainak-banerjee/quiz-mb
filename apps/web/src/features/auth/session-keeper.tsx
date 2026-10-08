'use client';
import { useEffect } from 'react';
import { onSessionRenewed, refreshSession } from '@/lib/api/browser';

/** Renew this long before the access token expires (at most). */
const RENEW_BEFORE_MS = 60_000;

/**
 * Keeps a signed-in tab's access token fresh in the background, so pages
 * the web server renders never find it expired. Renews shortly before it
 * expires, and at once when the tab comes back (after sleep or a long time
 * hidden, when timers did not run). Renders nothing; a refused renewal
 * signs the user out (see refreshSession).
 */
export function SessionKeeper({
  expiresAt,
  lifetimeSeconds,
}: {
  /** When the current access token expires (ms since the epoch). */
  expiresAt: number;
  /** A fresh token's lifetime, for scheduling after each renewal. */
  lifetimeSeconds: number;
}) {
  useEffect(() => {
    const lifetimeMs = lifetimeSeconds * 1000;
    // Short lifetimes (tests, local runs) renew at three quarters.
    const margin = Math.min(RENEW_BEFORE_MS, lifetimeMs / 4);
    let dueAt = expiresAt - margin;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const renew = () => {
      // Network failures keep the old schedule; the next check retries.
      refreshSession().catch(() => schedule(Date.now() + margin));
    };
    function schedule(at: number) {
      dueAt = at;
      clearTimeout(timer);
      timer = setTimeout(renew, Math.max(0, dueAt - Date.now()));
    }
    const check = () => {
      if (document.visibilityState === 'visible' && Date.now() >= dueAt)
        renew();
    };

    schedule(dueAt);
    // Any renewal (this one, or an API call's) starts a fresh token.
    const stop = onSessionRenewed(() =>
      schedule(Date.now() + lifetimeMs - margin),
    );
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      clearTimeout(timer);
      stop();
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, [expiresAt, lifetimeSeconds]);
  return null;
}
