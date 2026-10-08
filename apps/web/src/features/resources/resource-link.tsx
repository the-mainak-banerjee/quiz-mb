import type { ComponentProps } from 'react';
import { NavigationItem } from '@/components/workspace/navigation-item';
import { cn } from '@/lib/utils';

/** Background-backed actions scoped to resource-page content. */
export function ResourceLink({
  className,
  ...props
}: ComponentProps<typeof NavigationItem>) {
  return (
    <NavigationItem
      {...props}
      className={cn(
        'max-w-full bg-action-secondary text-accent hover:bg-action-secondary-hover hover:text-accent',
        className,
      )}
    />
  );
}
