'use client';

import { usePathname } from 'next/navigation';
import { PublicHeader } from '@/components/workspace/public-header';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { APP_LINKS } from '@/config/navigation';
import type { CurrentUser } from '@/lib/auth/session';

const PUBLIC_LINKS = [
  { label: 'Documentation', href: APP_LINKS.FOOTER.DOCUMENTATION },
  { label: 'Help Center', href: APP_LINKS.FOOTER.HELP },
];
/** Workspace pages: only offered to signed-in visitors. */
const WORKSPACE_LINKS = [
  { label: 'Projects', href: APP_LINKS.WORKSPACE.PROJECTS },
  { label: 'Quizzes', href: APP_LINKS.WORKSPACE.QUIZZES },
];

export function ResourcesHeader({ user }: { user: CurrentUser | null }) {
  const pathname = usePathname();
  const links = user ? [...PUBLIC_LINKS, ...WORKSPACE_LINKS] : PUBLIC_LINKS;
  return (
    <PublicHeader user={user} returnTo={pathname}>
      <nav
        aria-label="Public resources"
        className="order-last flex w-full flex-wrap items-center gap-space-xs md:order-none md:w-auto md:flex-1 md:pl-space-md"
      >
        {links.map(({ label, href }) => (
          <NavigationItem key={href} href={href} active={pathname === href}>
            {label}
          </NavigationItem>
        ))}
      </nav>
    </PublicHeader>
  );
}
