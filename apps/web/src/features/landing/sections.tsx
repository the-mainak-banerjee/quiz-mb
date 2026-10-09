import Link from 'next/link';
import type { ReactNode } from 'react';
import { Text } from '@/components/ui';
import { Brand } from '@/components/brand';
import { APP_LINKS } from '@/config/navigation';
import { cn } from '@/lib/utils';
import { CurrentUserProvider } from '@/contexts/current-user-context';
import { AccountMenu } from '@/components/workspace/account-menu';
import type { CurrentUser } from '@/lib/auth/session';
import { NAV_LINKS, SIGN_IN_HREF, START_HREF } from './content';
import { ArrowRight } from 'lucide-react';

/** The width and side margins every landing section shares. */
export const LANDING_CONTAINER =
  'mx-auto w-full max-w-content px-margin-sm md:px-margin lg:px-space-xl';

/** Primary and secondary calls to action, as links. */
export function CtaLink({
  href = START_HREF,
  variant = 'primary',
  children,
  className,
}: {
  href?: string;
  variant?: 'primary' | 'outline' | 'inverse' | 'ghost';
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'ds-focus ds-control-motion ds-primary-motion inline-flex h-control-large items-center justify-center gap-space-xs rounded-control px-space-md text-label',
        variant === 'primary' &&
          'bg-action-primary text-action-on-primary shadow-raised hover:bg-action-primary-hover',
        variant === 'outline' &&
          'border border-border-surface bg-surface text-text-primary hover:border-accent',
        variant === 'ghost' &&
          'text-text-secondary hover:bg-surface-low hover:text-text-primary',
        variant === 'inverse' &&
          'bg-surface text-action-primary shadow-raised hover:bg-action-secondary',
        className,
      )}
    >
      {children}
    </Link>
  );
}

export function LandingNav({ user = null }: { user?: CurrentUser | null }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border-surface bg-canvas/85 backdrop-blur-md">
      <div
        className={cn(
          LANDING_CONTAINER,
          'flex h-16 items-center justify-between gap-space-sm',
        )}
      >
        <Link
          href={APP_LINKS.HOME}
          aria-label="QuizMB home"
          className="ds-focus shrink-0 [&_svg]:h-space-lg"
        >
          <Brand />
        </Link>
        <nav aria-label="Page sections" className="hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="ds-focus rounded-control px-space-sm py-2 text-label text-text-secondary transition-colors hover:text-text-primary"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="flex items-center gap-space-xs">
          {user ? (
            <>
              <CtaLink
                href={APP_LINKS.WORKSPACE.DASHBOARD}
                variant="ghost"
                className="h-control shrink-0 whitespace-nowrap px-control-x"
              >
                <span className="sm:hidden">Dashboard</span>
                <span className="hidden sm:inline">Go to dashboard</span>
              </CtaLink>
              <CurrentUserProvider initialUser={user}>
                <AccountMenu />
              </CurrentUserProvider>
            </>
          ) : (
            <>
              <Link
                href={SIGN_IN_HREF}
                className="ds-focus hidden rounded-control px-space-sm py-2 text-label text-text-secondary hover:text-text-primary sm:inline-flex"
              >
                Sign in
              </Link>
              <CtaLink className="h-control px-control-x">
                Start free
                <ArrowRight size={18} aria-hidden="true" />
              </CtaLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

/** Small uppercase section label. */
export function Eyebrow({
  children,
  inverse = false,
}: {
  children: ReactNode;
  inverse?: boolean;
}) {
  return (
    <Text
      variant="label"
      className={cn(
        'tracking-wider uppercase',
        inverse ? 'text-accent-soft' : 'text-accent',
      )}
    >
      {children}
    </Text>
  );
}
