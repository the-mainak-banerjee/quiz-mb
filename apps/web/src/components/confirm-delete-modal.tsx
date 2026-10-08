'use client';
import { useState, type ReactNode } from 'react';
import { Button, Text } from '@/components/ui';
import { Modal } from '@/components/ui/modal';
import { apiError } from '@/lib/api/client';

/**
 * Confirms a permanent deletion. `onConfirm` runs the delete; while it runs
 * the modal cannot be closed, and its error is shown here.
 */
export function ConfirmDeleteModal({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  children,
  confirmDisabled = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
  /** Extra content above the buttons, e.g. confirmation fields. */
  children?: ReactNode;
  /** Keeps the delete button disabled until the extra fields are complete. */
  confirmDisabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function close(next: boolean) {
    if (busy) return;
    if (!next) setError('');
    onOpenChange(next);
  }
  return (
    <Modal
      open={open}
      onOpenChange={close}
      title={title}
      description={description}
    >
      {children}
      {error && (
        <Text role="alert" className="mb-space-sm text-danger">
          {error}
        </Text>
      )}
      <div className="flex justify-end gap-space-xs">
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => close(false)}
        >
          Cancel
        </Button>
        <Button
          variant="danger"
          disabled={busy || confirmDisabled}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await onConfirm();
            } catch (caught) {
              setError(apiError(caught).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Deleting…' : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
