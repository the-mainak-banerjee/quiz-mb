import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type InputProps = Omit<ComponentProps<'input'>, 'type' | 'size'> & {
  type?: 'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number';
};

export function Input({ type = 'text', className, ...props }: InputProps) {
  return (
    <input
      {...props}
      type={type}
      className={cn(
        'ds-control-motion block h-control-large w-full rounded-control border-(length:--stroke-width) border-border-control bg-surface px-control-x text-body text-text-primary placeholder:text-placeholder focus:border-accent focus:shadow-focus focus:outline-none aria-invalid:border-danger disabled:cursor-not-allowed disabled:opacity-(--disabled-opacity)',
        className,
      )}
    />
  );
}
