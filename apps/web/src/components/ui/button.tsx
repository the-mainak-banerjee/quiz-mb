import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

type Appearance =
  | { variant?: 'primary'; size?: 'default' | 'hero' }
  | {
      variant: 'secondary' | 'outline' | 'ghost' | 'danger';
      size?: 'default';
    };
export type ButtonProps = ComponentProps<'button'> & Appearance;

const variants = {
  primary:
    'bg-action-primary text-action-on-primary enabled:hover:bg-action-primary-hover ds-primary-motion',
  secondary:
    'bg-action-secondary text-accent enabled:hover:bg-action-secondary-hover',
  outline:
    'bg-surface border-(length:--stroke-width) border-border-surface text-text-primary enabled:hover:border-accent enabled:hover:bg-canvas',
  ghost:
    'bg-transparent text-text-secondary enabled:hover:bg-action-secondary enabled:hover:text-text-primary',
  danger: 'bg-danger text-action-on-primary enabled:hover:bg-danger-on-surface',
};

export function Button({
  variant = 'primary',
  size = 'default',
  type = 'button',
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      className={cn(
        'ds-focus ds-control-motion inline-flex shrink-0 cursor-pointer items-center justify-center gap-space-xs rounded-control px-control-x text-label disabled:cursor-not-allowed disabled:opacity-(--disabled-opacity)',
        size === 'hero' ? 'h-control-large' : 'h-control',
        variants[variant],
        className,
      )}
    />
  );
}
