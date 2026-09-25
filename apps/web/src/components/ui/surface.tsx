import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

export type SurfaceProps = HTMLAttributes<HTMLElement> & {
  as?: 'div' | 'section' | 'article';
};

export function Surface({
  as: Tag = 'div',
  className,
  ...props
}: SurfaceProps) {
  return (
    <Tag
      {...props}
      className={cn(
        'rounded-card border-(length:--stroke-width) border-border-surface bg-surface p-space-md shadow-card',
        className,
      )}
    />
  );
}
