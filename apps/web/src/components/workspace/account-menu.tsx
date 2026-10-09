'use client';

import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ChevronDown, Settings2, UserRound } from 'lucide-react';
import { Button, Text } from '@/components/ui';
import { useCurrentUser } from '@/contexts/current-user-context';
import { APP_LINKS } from '@/config/navigation';
import { LogoutButton } from '@/features/auth/logout-button';
import { NavigationItem } from './navigation-item';

/** Shared account actions for workspace and public landing headers. */
export function AccountMenu() {
  const {
    user: { name, email },
  } = useCurrentUser();

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          aria-label="Account options"
          className="gap-space-xs px-0"
          icon={<ChevronDown size={16} aria-hidden="true" />}
          iconPosition="right"
        >
          <div className="flex size-control items-center justify-center rounded-pill bg-action-primary text-action-on-primary">
            <UserRound size={18} aria-hidden="true" />
          </div>
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
            <Text variant="caption" tone="secondary" className="break-all">
              {email}
            </Text>
          </div>
          <div className="space-y-space-sm p-space-xs pt-2">
            <DropdownMenu.Group className="flex flex-col gap-space-xs">
              <DropdownMenu.Item asChild>
                <NavigationItem
                  className="w-full justify-start data-highlighted:bg-surface-low"
                  href={APP_LINKS.ACCOUNT.SETTINGS}
                  icon={<Settings2 size={18} aria-hidden="true" />}
                >
                  Settings
                </NavigationItem>
              </DropdownMenu.Item>
              {/* <DropdownMenu.Item asChild>
                <NavigationItem
                  className="w-full justify-start data-highlighted:bg-surface-low"
                  href={APP_LINKS.ACCOUNT.PLANS}
                  icon={<Award size={18} aria-hidden="true" />}
                >
                  Workspace plan
                </NavigationItem>
              </DropdownMenu.Item> */}
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
  );
}
