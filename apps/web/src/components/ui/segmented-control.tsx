import { cn } from '@/lib/utils';

export type SegmentedControlProps<Value extends string> = {
  options: ReadonlyArray<{ value: Value; label: string }>;
  value: Value;
  onValueChange: (value: Value) => void;
  /** Accessible name for the group, e.g. "Filter participants". */
  label: string;
  className?: string;
};

/** Mutually exclusive buttons that switch local presentation state. */
export function SegmentedControl<Value extends string>({
  options,
  value,
  onValueChange,
  label,
  className,
}: SegmentedControlProps<Value>) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        'inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-control bg-surface-low p-1',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'ds-focus ds-control-motion shrink-0 cursor-pointer rounded-sm px-3 py-1 text-caption whitespace-nowrap',
              selected
                ? 'bg-surface font-semibold text-text-primary shadow-card'
                : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
