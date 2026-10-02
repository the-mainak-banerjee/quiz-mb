import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export type SwitchProps = Omit<
  ComponentProps<'button'>,
  'role' | 'type' | 'onChange' | 'children'
> & {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
};

/** Binary on/off control. Name it with aria-label or aria-labelledby. */
export function Switch({
  checked,
  onCheckedChange,
  onClick,
  className,
  ...props
}: SwitchProps) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange?.(!checked);
      }}
      className={cn(
        'ds-focus ds-control-motion relative inline-flex h-space-md w-11 shrink-0 cursor-pointer items-center rounded-pill p-0.5 disabled:cursor-not-allowed disabled:opacity-(--disabled-opacity)',
        checked ? 'bg-action-primary' : 'bg-surface-highest',
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'ds-control-motion size-5 rounded-pill bg-surface shadow-card',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}
