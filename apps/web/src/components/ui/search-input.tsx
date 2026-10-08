'use client';

import type { ComponentProps } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from './input';

export type SearchInputProps = Omit<
  ComponentProps<typeof Input>,
  'type' | 'value' | 'onChange'
> & {
  value: string;
  onValueChange: (value: string) => void;
  /** A leading magnifying glass inside the field. */
  showIcon?: boolean;
  /** Accessible name of the clear button. */
  clearLabel?: string;
};

/**
 * A search field with a clear button. The browser's own cancel "x" is hidden
 * (it is tiny and styled differently in every browser); ours is a Lucide
 * icon with a full control-height click area, shown only when there is text.
 */
export function SearchInput({
  value,
  onValueChange,
  showIcon = true,
  clearLabel = 'Clear search',
  className,
  tabIndex,
  ...props
}: SearchInputProps) {
  return (
    <div className="relative w-full">
      {showIcon && (
        <Search
          size={18}
          aria-hidden="true"
          className="pointer-events-none absolute left-control-x top-1/2 -translate-y-1/2 text-text-secondary"
        />
      )}
      <Input
        {...props}
        type="search"
        value={value}
        tabIndex={tabIndex}
        onChange={(event) => onValueChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && value) {
            event.preventDefault();
            onValueChange('');
          }
          props.onKeyDown?.(event);
        }}
        className={cn(
          'pr-control [&::-webkit-search-cancel-button]:appearance-none',
          showIcon && 'pl-space-xl',
          className,
        )}
      />
      {value && (
        <button
          type="button"
          aria-label={clearLabel}
          tabIndex={tabIndex}
          onClick={(event) => {
            // The button disappears: keep the cursor in the field.
            event.currentTarget.parentElement?.querySelector('input')?.focus();
            onValueChange('');
          }}
          className="ds-focus absolute inset-y-0 right-0 flex w-control items-center justify-center rounded-r-control text-text-secondary transition-colors hover:text-text-primary"
        >
          <X size={18} aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
