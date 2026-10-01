'use client';

import { useEffect, useState } from 'react';

const TICK_MS = 250;

const secondsUntil = (deadline: number) =>
  Math.max(0, Math.ceil((deadline - Date.now()) / 1000));

/**
 * Whole seconds left until a server deadline, corrected by the server clock
 * offset. Display only: the server alone decides when answers close.
 */
export function useRemainingSeconds(endsAt: string, clockOffsetMs: number) {
  const deadline = Date.parse(endsAt) - clockOffsetMs;
  const [remaining, setRemaining] = useState(() => secondsUntil(deadline));

  useEffect(() => {
    const update = () => setRemaining(secondsUntil(deadline));
    update();
    const timer = window.setInterval(update, TICK_MS);
    return () => window.clearInterval(timer);
  }, [deadline]);

  return remaining;
}
