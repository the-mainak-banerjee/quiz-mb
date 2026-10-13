'use client';

import { useSyncExternalStore } from 'react';
import { getGreeting } from '@/lib/utils';

const noSubscription = () => () => {};

/**
 * "Good morning," etc. by the viewer's own clock. The server renders a
 * neutral "Hello," (it only knows its own time zone); the browser swaps in
 * the local greeting right after hydration, without a mismatch.
 */
export function Greeting() {
  return useSyncExternalStore(noSubscription, getGreeting, () => 'Hello,');
}
