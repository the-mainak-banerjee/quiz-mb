import type { ReactNode } from 'react';
import { Text } from '@/components/ui';
export function Field({
  id,
  label,
  error,
  hint,
  required = false,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-space-xs">
      <label htmlFor={id} className="text-label">
        {label} {required && <span className="text-danger">*</span>}
      </label>
      {children}
      {hint && (
        <Text variant="caption" tone="secondary">
          {hint}
        </Text>
      )}
      {error && (
        <Text
          id={`${id}-error`}
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
