import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';
export function Select({ className, ...props }: ComponentProps<'select'>) {
  return (
    <select
      {...props}
      className={cn(
        'ds-focus block h-control-large w-full rounded-control border border-border-control bg-surface px-control-x text-body aria-invalid:border-danger',
        className,
      )}
    />
  );
}
