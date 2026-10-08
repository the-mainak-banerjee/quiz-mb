'use client';

import { useState, type ComponentProps, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Button, Input, Text } from '@/components/ui';
import { VisuallyHidden } from '@/components/visually-hidden';

/** Password input with a show/hide toggle, label, hint and error. */
export function PasswordField({
  id,
  label,
  labelAction,
  hint,
  error,
  ...input
}: Omit<ComponentProps<typeof Input>, 'type' | 'id'> & {
  id: string;
  label: string;
  /** Shown at the end of the label row, e.g. a "Forgot password?" link. */
  labelAction?: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
}) {
  const [visible, setVisible] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = `${id}-error`;
  return (
    <div className="space-y-space-xs">
      <div className="flex items-center justify-between gap-space-xs">
        <label htmlFor={id} className="text-label">
          {label} {input.required && <span className="text-danger">*</span>}
        </label>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          {...input}
          id={id}
          type={visible ? 'text' : 'password'}
          aria-invalid={Boolean(error)}
          aria-describedby={[hintId, errorId].filter(Boolean).join(' ')}
          className="pr-space-2xl"
        />
        <Button
          type="button"
          variant="ghost"
          icon={
            visible ? (
              <EyeOff aria-hidden="true" size={16} />
            ) : (
              <Eye aria-hidden="true" size={16} />
            )
          }
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible(!visible)}
          className="absolute right-space-xs top-1/2 -translate-y-1/2 px-space-xs text-caption"
        >
          <VisuallyHidden>
            {visible ? 'Hide password' : 'Show password'}
          </VisuallyHidden>
        </Button>
      </div>
      {hint && (
        <Text id={hintId} variant="caption" tone="secondary">
          {hint}
        </Text>
      )}
      <Text
        id={errorId}
        role={error ? 'alert' : undefined}
        variant="body-secondary"
        className="text-danger"
      >
        {error}
      </Text>
    </div>
  );
}
