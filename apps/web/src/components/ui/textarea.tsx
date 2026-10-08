import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      {...props}
      className={cn(
        'ds-control-motion block w-full resize-none rounded-control border border-border-control bg-surface p-space-sm text-body text-text-primary placeholder:text-placeholder focus:border-accent focus:shadow-focus focus:outline-none aria-invalid:border-danger disabled:opacity-(--disabled-opacity)',
        className,
      )}
    />
  );
}
