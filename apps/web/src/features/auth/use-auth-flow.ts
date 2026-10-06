'use client';

import { useSyncExternalStore } from 'react';
import {
  authFlow,
  type ResetFlow,
  type VerificationFlow,
} from '@/lib/auth/auth-flow';

const subscribe = () => () => {};
const NOT_READ = 'not-read';

/**
 * This tab's stored flow state. `undefined` while rendering on the server
 * (and during hydration), then the stored value or null, so server and
 * browser markup always match.
 */
function useStored<T>(read: () => T | null): T | null | undefined {
  const raw = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(read()),
    () => NOT_READ,
  );
  return raw === NOT_READ ? undefined : (JSON.parse(raw) as T | null);
}

export const useVerificationFlow = (): VerificationFlow | null | undefined =>
  useStored(authFlow.verification);
export const useResetFlow = (): ResetFlow | null | undefined =>
  useStored(authFlow.reset);
