'use client';
import { useState } from 'react';
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
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
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
          disabled={busy}
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
