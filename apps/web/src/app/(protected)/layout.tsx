import type { ReactNode } from 'react';
import { accessLifetime, requireUser } from '@/lib/auth/session';
import { CurrentUserProvider } from '@/contexts/current-user-context';
import { SessionKeeper } from '@/features/auth/session-keeper';

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [user, lifetime] = await Promise.all([requireUser(), accessLifetime()]);
  return (
    <CurrentUserProvider initialUser={user}>
      {lifetime && <SessionKeeper {...lifetime} />}
      {children}
    </CurrentUserProvider>
  );
}
