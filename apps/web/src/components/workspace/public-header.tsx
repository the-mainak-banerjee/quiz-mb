import Link from 'next/link';
import type { ReactNode } from 'react';
import { Brand } from '@/components/brand';
import { CurrentUserProvider } from '@/contexts/current-user-context';
import { APP_LINKS } from '@/config/navigation';
import type { CurrentUser } from '@/lib/auth/session';
import { authLink } from '@/lib/auth/return-to';
import { NavigationItem } from './navigation-item';
import { WorkspaceHeader } from './workspace-header';

/** Public pages share the workspace header when the visitor is signed in. */
export function PublicHeader({
  user,
  returnTo,
  children,
}: {
  user: CurrentUser | null;
  returnTo: string;
  children?: ReactNode;
}) {
  if (user)
    return (
      <CurrentUserProvider initialUser={user}>
        <WorkspaceHeader />
      </CurrentUserProvider>
    );
  return (
    <header className="sticky top-0 z-30 border-b border-border-surface bg-canvas/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-content flex-wrap items-center justify-between gap-space-xs px-margin-sm py-space-xs md:px-margin lg:px-space-xl">
        <Link
          href={APP_LINKS.HOME}
          aria-label="QuizMB home"
          className="ds-focus shrink-0 [&_svg]:h-space-md sm:[&_svg]:h-space-lg"
        >
          <Brand />
        </Link>
        {children}
        <NavigationItem
          href={authLink(APP_LINKS.AUTH.LOGIN, returnTo)}
          className="border border-border-surface bg-surface"
        >
          Sign in
        </NavigationItem>
      </div>
    </header>
  );
}
