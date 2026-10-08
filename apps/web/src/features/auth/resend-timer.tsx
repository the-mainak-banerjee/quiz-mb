'use client';

import { useEffect, useState } from 'react';

/**
 * Whole seconds until `availableAt`, ticking down to 0 once a second. Only
 * used by screens that render after reading this tab's flow state, so the
 * browser clock is the only clock involved.
 */
export function useSecondsUntil(availableAt: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const target = availableAt ? Date.parse(availableAt) : 0;
  return Math.max(0, Math.ceil((target - now) / 1000));
}

/** "Resend code in 45s", "… in 12 min", "… in 3 h" for longer limits. */
export function resendLabel(seconds: number) {
  if (seconds < 60) return `Resend code in ${seconds}s`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `Resend code in ${minutes} min`;
  return `Resend code in ${Math.ceil(minutes / 60)} h`;
}
