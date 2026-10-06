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
