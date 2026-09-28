'use client';
import { NavigationGuardLink as Link } from 'nextjs-nav-guard';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function NavigationItem({
  href,
  children,
  active = false,
  icon,
  iconPosition = 'left',
  className,
  ...props
}: Omit<ComponentProps<typeof Link>, 'children'> & {
  children: ReactNode;
  active?: boolean;
  icon?: ReactNode;
  iconPosition?: 'left' | 'right';
}) {
  return (
    <Link
      href={href}
      {...props}
      className={cn(
        'ds-focus ds-control-motion inline-flex min-h-control items-center justify-center gap-space-xs rounded-control px-control-x text-center text-label text-text-secondary hover:bg-surface-low hover:text-text-primary',
        active && 'bg-surface-muted text-text-primary',
        className,
      )}
    >
      {icon && iconPosition === 'left' && icon}
      {children}
      {icon && iconPosition === 'right' && icon}
    </Link>
  );
}
