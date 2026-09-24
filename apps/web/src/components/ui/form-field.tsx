'use client';

import { useId, type ReactNode } from 'react';
import { Input, type InputProps } from './input';

export type FormFieldProps = Omit<InputProps, 'children'> & {
  label: string;
  hint?: ReactNode;
  error?: string;
};

export function FormField({
  id,
  label,
  hint,
  error,
  'aria-describedby': describedBy,
  'aria-invalid': invalid,
  ...inputProps
}: FormFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const description =
    [describedBy, hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className="flex flex-col gap-space-xs">
      <label htmlFor={inputId} className="text-label text-text-primary">
        {label}
      </label>
      <Input
        {...inputProps}
        id={inputId}
        aria-describedby={description}
        aria-invalid={error ? true : invalid}
      />
      {hint && (
        <p id={hintId} className="text-body-secondary text-text-secondary">
          {hint}
        </p>
      )}
      {error && (
        <p
          id={errorId}
          role="alert"
          className="text-body-secondary text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}
