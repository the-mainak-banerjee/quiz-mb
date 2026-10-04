import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
export function Choice({
  className,
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & { type: 'radio' | 'checkbox' }) {
  return (
    <input
      {...props}
      className={cn(
        'ds-focus size-space-sm shrink-0 accent-action-primary disabled:cursor-not-allowed disabled:opacity-(--disabled-opacity)',
        className,
      )}
    />
  );
}
