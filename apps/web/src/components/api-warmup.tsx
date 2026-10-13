'use client';

import { useEffect } from 'react';
import { wakeApi } from '@/lib/api/wake';

/**
 * Starts waking the API as soon as any page loads, so a sign-in, sign-up
 * or join a moment later finds it already running. Renders nothing.
 */
export function ApiWarmup() {
  useEffect(() => {
    wakeApi();
  }, []);
  return null;
}
