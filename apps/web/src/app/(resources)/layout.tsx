import type { ReactNode } from 'react';
import { WorkspaceFooter } from '@/components/workspace/workspace-footer';
import { ResourcesHeader } from '@/features/resources/resources-header';
import { SessionKeeper } from '@/features/auth/session-keeper';
import { accessLifetime, currentUser } from '@/lib/auth/session';

export default async function ResourcesLayout({
  children,
}: {
  children: ReactNode;
}) {
  const [user, lifetime] = await Promise.all([
    currentUser(false),
    accessLifetime(),
  ]);
  return (
    <div className="flex min-h-screen flex-col">
      {user && lifetime && <SessionKeeper {...lifetime} />}
      <ResourcesHeader user={user} />
      {children}
      <WorkspaceFooter />
    </div>
  );
}
