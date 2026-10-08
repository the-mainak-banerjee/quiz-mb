'use client';

import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { OTP_RULES } from '@quizmb/contracts';
import { cn } from '@/lib/utils';

/**
 * Six single-digit boxes for a one-time code. Typing moves forward,
 * Backspace moves back, and pasting a whole code fills every box. The
 * first box offers `one-time-code` autofill on phones.
 */
export function OtpInput({
  value,
  onChange,
  invalid = false,
  disabled = false,
  label,
  describedBy,
}: {
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  /** Accessible name of the group, e.g. "Verification code". */
  label: string;
  describedBy?: string | undefined;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from(
    { length: OTP_RULES.length },
    (_, i) => value[i] ?? '',
  );

  function set(next: string, focus: number) {
    onChange(next.replace(/\D/g, '').slice(0, OTP_RULES.length));
    boxes.current[Math.min(focus, OTP_RULES.length - 1)]?.focus();
  }

  function type(index: number, raw: string) {
    const typed = raw.replace(/\D/g, '');
    if (!typed) return;
    // Autofill and fast typing can put several digits in one box.
    const next = (value.slice(0, index) + typed).slice(0, OTP_RULES.length);
    set(next, index + typed.length);
  }

  function key(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (digits[index])
        set(value.slice(0, index) + value.slice(index + 1), index);
      else if (index > 0)
        set(value.slice(0, index - 1) + value.slice(index), index - 1);
    } else if (event.key === 'ArrowLeft' && index > 0) {
      boxes.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < OTP_RULES.length - 1) {
      boxes.current[index + 1]?.focus();
    }
  }

  function paste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!pasted) return;
    event.preventDefault();
    set(pasted, pasted.length);
  }

  return (
    <div
      role="group"
      aria-label={label}
      aria-describedby={describedBy}
      className="grid grid-cols-6 gap-space-xs"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            boxes.current[index] = element;
          }}
          value={digit}
          onChange={(event) => type(index, event.target.value)}
          onKeyDown={(event) => key(index, event)}
          onPaste={paste}
          onFocus={(event) => event.target.select()}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={OTP_RULES.length}
          disabled={disabled}
          aria-label={`Digit ${index + 1} of ${OTP_RULES.length}`}
          aria-invalid={invalid || undefined}
          className={cn(
            'ds-control-motion h-control-large w-full min-w-0 rounded-control border-(length:--stroke-width) border-border-control bg-surface text-center text-section-heading text-text-primary tabular-nums focus:border-accent focus:shadow-focus focus:outline-none disabled:cursor-not-allowed disabled:opacity-(--disabled-opacity)',
            invalid && 'border-danger text-danger',
          )}
        />
      ))}
    </div>
  );
}
