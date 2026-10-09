'use client';

import Link from 'next/link';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Brand } from '@/components/brand';
import { Button } from '@/components/ui';
import { VisuallyHidden } from '@/components/visually-hidden';
import { APP_LINKS, MAIN_NAVIGATION } from '@/config/navigation';
import { LogoutButton } from '@/features/auth/logout-button';
import { NavigationItem } from './navigation-item';
import { AccountMenu } from './account-menu';

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceHeader() {
  const pathname = usePathname();
  const [mobileNavigationOpen, setMobileNavigationOpen] = useState(false);

  return (
    <Dialog.Root
      open={mobileNavigationOpen}
      onOpenChange={setMobileNavigationOpen}
    >
      <header className="sticky top-0 z-30 border-b border-border-surface bg-canvas">
        <div className="relative mx-auto flex max-w-content items-center justify-between gap-space-xs px-margin-sm py-space-xs md:px-margin lg:px-space-xl">
          <div className="flex items-center gap-space-xs">
            <Dialog.Trigger asChild>
              <Button
                variant="ghost"
                className="px-space-xs md:hidden"
                icon={<Menu size={22} aria-hidden="true" />}
              >
                <VisuallyHidden>Open navigation</VisuallyHidden>
              </Button>
            </Dialog.Trigger>
            <Link
              href={APP_LINKS.HOME}
              aria-label="QuizMB home"
              className="ds-focus shrink-0 [&_svg]:h-space-md sm:[&_svg]:h-space-lg"
            >
              <Brand />
            </Link>
          </div>

          <nav
            aria-label="Workspace"
            className="hidden items-center gap-space-xs md:flex md:flex-1 md:pl-space-sm"
          >
            {MAIN_NAVIGATION.map(({ label, href }) => (
              <NavigationItem
                key={href}
                href={href}
                active={isActiveRoute(pathname, href)}
              >
                {label}
              </NavigationItem>
            ))}
          </nav>

          <AccountMenu />
        </div>

        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
          <Dialog.Content
            aria-describedby={undefined}
            id="mobile-workspace-navigation"
            className="fixed inset-y-0 left-0 z-50 flex w-4/5 max-w-xs flex-col gap-space-lg overflow-y-auto bg-surface  shadow-floating py-space-md"
          >
            <Dialog.Title asChild>
              <VisuallyHidden>Mobile workspace navigation</VisuallyHidden>
            </Dialog.Title>
            <div className="flex items-center justify-between gap-space-sm px-space-md">
              <Brand />
              <Dialog.Close asChild>
                <Button
                  variant="ghost"
                  className="px-space-xs"
                  icon={<X size={22} aria-hidden="true" />}
                >
                  <VisuallyHidden>Close navigation</VisuallyHidden>
                </Button>
              </Dialog.Close>
            </div>
            <nav
              aria-label="Mobile workspace"
              className="flex flex-col gap-space-xs px-space-md"
            >
              {MAIN_NAVIGATION.map(({ label, href }) => (
                <NavigationItem
                  key={href}
                  href={href}
                  active={isActiveRoute(pathname, href)}
                  className="w-full justify-start"
                  onClick={() => setMobileNavigationOpen(false)}
                >
                  {label}
                </NavigationItem>
              ))}
            </nav>
            <div className="mt-auto border-t border-border-surface p-space-md pb-0">
              <LogoutButton />
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </header>
    </Dialog.Root>
  );
}
