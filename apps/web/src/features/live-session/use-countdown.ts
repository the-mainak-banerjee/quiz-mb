'use client';

import { useEffect, useState } from 'react';

const TICK_MS = 250;

/**
 * Whole seconds left until a server deadline, corrected by the server clock
 * offset. Display only: the server alone decides when answers close.
 */
export function useRemainingSeconds(endsAt: string, clockOffsetMs: number) {
  const deadline = Date.parse(endsAt) - clockOffsetMs;
  const read = () => Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  const [remaining, setRemaining] = useState(read);

  useEffect(() => {
    const update = () =>
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, TICK_MS);
    return () => window.clearInterval(timer);
  }, [deadline]);

  return remaining;
}
