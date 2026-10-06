'use client';

import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type InputProps = Omit<ComponentProps<'input'>, 'type' | 'size'> & {
  type?:
    | 'text'
    | 'email'
    | 'password'
    | 'search'
    | 'tel'
    | 'url'
    | 'number'
    | 'datetime-local'
    | 'file';
};

export function Input({
  type = 'text',
  className,
  onWheel,
  ...props
}: InputProps) {
  return (
    <input
      {...props}
      type={type}
      // A wheel over a focused number field would silently change its value;
      // blur it so the wheel scrolls the page instead.
      onWheel={(event) => {
        if (type === 'number') event.currentTarget.blur();
        onWheel?.(event);
      }}
      className={cn(
        'ds-control-motion block h-control-large w-full rounded-control border-(length:--stroke-width) border-border-control bg-surface px-control-x text-body text-text-primary placeholder:text-placeholder focus:border-accent focus:shadow-focus focus:outline-none aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-(--disabled-opacity)',
        className,
      )}
    />
  );
}
