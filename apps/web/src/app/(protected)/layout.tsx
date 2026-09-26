import type { ReactNode } from 'react';
import { requireUser } from '@/lib/auth/session';
import { CurrentUserProvider } from '@/contexts/current-user-context';

export default async function ProtectedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await requireUser();
  return (
    <CurrentUserProvider initialUser={user}>{children}</CurrentUserProvider>
  );
}
