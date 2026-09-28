'use client';
import { NavigationGuardProvider as GuardProvider } from 'nextjs-nav-guard';
import { createContext, useContext, useState, type ReactNode } from 'react';
type Handler = (action: () => void) => void;
export const DirtyActionsContext = createContext(new Set<Handler>());
export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const [handlers] = useState(() => new Set<Handler>());
  return (
    <DirtyActionsContext.Provider value={handlers}>
      <GuardProvider>{children}</GuardProvider>
    </DirtyActionsContext.Provider>
  );
}
export function useGuardedAction() {
  const handlers = useContext(DirtyActionsContext);
  return (action: () => void) => {
    const guard = [...handlers].at(-1);
    if (guard) guard(action);
    else action();
  };
}
