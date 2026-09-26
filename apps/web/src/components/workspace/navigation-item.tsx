import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function NavigationItem({
  href,
  children,
  active = false,
  className,
  ...props
}: Omit<ComponentProps<typeof Link>, 'children'> & {
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      {...props}
      className={cn(
        'ds-focus ds-control-motion inline-flex min-h-control items-center rounded-control px-control-x text-label text-text-secondary hover:bg-surface-low hover:text-text-primary',
        active && 'bg-surface-muted text-text-primary',
        className,
      )}
    >
      {children}
    </Link>
  );
}
