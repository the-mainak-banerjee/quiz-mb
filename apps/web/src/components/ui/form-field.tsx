'use client';

import { useId, type ReactNode } from 'react';
import { Input, type InputProps } from './input';
import { Text } from './text';

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
        {label} {inputProps.required && <span className="text-danger">*</span>}
      </label>
      <Input
        {...inputProps}
        id={inputId}
        aria-describedby={description}
        aria-invalid={error ? true : invalid}
      />
      {hint && (
        <Text id={hintId} variant="body-secondary" tone="secondary">
          {hint}
        </Text>
      )}
      {error && (
        <Text
          id={errorId}
          role="alert"
          variant="body-secondary"
          className="text-danger"
        >
          {error}
        </Text>
      )}
    </div>
  );
}
