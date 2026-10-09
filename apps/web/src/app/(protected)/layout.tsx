import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import { NO_INDEX } from '@/config/seo';
import { accessLifetime, requireUser } from '@/lib/auth/session';
import { CurrentUserProvider } from '@/contexts/current-user-context';
import { SessionKeeper } from '@/features/auth/session-keeper';

export const metadata: Metadata = {
  title: 'Workspace',
  description:
    'Manage your QuizMB projects, quizzes, registrations, and results.',
  robots: NO_INDEX,
};

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
