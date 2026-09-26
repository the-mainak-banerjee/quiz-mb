'use client';

import Link from 'next/link';
import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Award,
  ChevronDown,
  Menu,
  Settings2,
  UserRound,
  X,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { Brand } from '@/components/brand';
import { Button, Text } from '@/components/ui';
import { VisuallyHidden } from '@/components/visually-hidden';
import { useCurrentUser } from '@/contexts/current-user-context';
import { APP_LINKS, MAIN_NAVIGATION } from '@/config/navigation';
import { LogoutButton } from '@/features/auth/logout-button';
import { NavigationItem } from './navigation-item';

function isActiveRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function WorkspaceHeader() {
  const {
    user: { name, email },
  } = useCurrentUser();
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
              <Button variant="ghost" className="px-space-xs md:hidden">
                <Menu size={22} aria-hidden="true" />
                <VisuallyHidden>Open navigation</VisuallyHidden>
              </Button>
            </Dialog.Trigger>
            <Link
              href={APP_LINKS.HOME}
              aria-label="QuizMB home"
              className="ds-focus shrink-0 [&_svg]:h-space-lg"
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

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                variant="ghost"
                aria-label="Account options"
                className="gap-space-xs px-0"
              >
                <div className="flex size-control items-center justify-center rounded-pill bg-action-primary text-action-on-primary">
                  <UserRound size={18} aria-hidden="true" />
                </div>
                <ChevronDown size={16} aria-hidden="true" />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                collisionPadding={16}
                className="z-50 max-h-(--radix-dropdown-menu-content-available-height) w-max max-w-[calc(100vw-var(--spacing-margin))] overflow-hidden overflow-y-auto rounded-card border border-border-surface bg-surface shadow-floating"
              >
                <div className="min-w-0 border-b border-border-surface p-space-md">
                  <Text variant="label" className="wrap-break-word">
                    {name}
                  </Text>
                  <Text
                    variant="caption"
                    tone="secondary"
                    className="break-all"
                  >
                    {email}
                  </Text>
                </div>
                <div className="space-y-space-sm p-space-xs pt-2">
                  <DropdownMenu.Group className="flex flex-col gap-space-xs">
                    <DropdownMenu.Item asChild>
                      <NavigationItem
                        className="w-full gap-space-xs data-highlighted:bg-surface-low"
                        href={APP_LINKS.ACCOUNT.SETTINGS}
                      >
                        <Settings2 size={18} aria-hidden="true" />
                        Settings
                      </NavigationItem>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item asChild>
                      <NavigationItem
                        className="w-full gap-space-xs data-highlighted:bg-surface-low"
                        href={APP_LINKS.ACCOUNT.PLANS}
                      >
                        <Award size={18} aria-hidden="true" />
                        Workspace plan
                      </NavigationItem>
                    </DropdownMenu.Item>
                  </DropdownMenu.Group>
                  <LogoutButton
                    renderAction={(props) => (
                      <DropdownMenu.Item
                        asChild
                        disabled={props.disabled ?? false}
                        onSelect={(event) => event.preventDefault()}
                      >
                        <Button {...props} />
                      </DropdownMenu.Item>
                    )}
                  />
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
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
                <Button variant="ghost" className="px-space-xs">
                  <X size={22} aria-hidden="true" />
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
                  className="w-full"
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
