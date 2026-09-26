'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import type { CurrentUser } from '@/lib/auth/session';

const CurrentUserContext = createContext<{
  user: CurrentUser;
  updateUser: (user: CurrentUser) => void;
} | null>(null);

export function CurrentUserProvider({
  initialUser,
  children,
}: {
  initialUser: CurrentUser;
  children: ReactNode;
}) {
  const [user, setUser] = useState(initialUser);
  const [previousInitialUser, setPreviousInitialUser] = useState(initialUser);

  // Reconcile fresh server props without an auth-fetching effect.
  if (initialUser !== previousInitialUser) {
    setPreviousInitialUser(initialUser);
    setUser(initialUser);
  }

  return (
    <CurrentUserContext.Provider value={{ user, updateUser: setUser }}>
      {children}
    </CurrentUserContext.Provider>
  );
}

// Call updateUser with the successful profile API response, never unsaved form input.
// This is presentation state; server-side checks remain authoritative.
export function useCurrentUser() {
  const value = useContext(CurrentUserContext);
  if (!value) throw new Error('useCurrentUser requires CurrentUserProvider');
  return value;
}
