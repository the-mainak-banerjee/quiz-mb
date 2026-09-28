'use client';
import { useNavigationGuard } from 'nextjs-nav-guard';
import { useRef, useState, useEffect, useContext } from 'react';
import { DirtyActionsContext } from './navigation-provider';
import { Button } from '@/components/ui';
import { Modal } from '@/components/ui/modal';

// One guard for route changes and explicit editor transitions. Beforeunload is
// handled by the library with the browser-owned warning for refresh/tab close.
export function useUnsavedChanges(dirty: boolean) {
  const allowed = useRef(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const guard = useNavigationGuard({
    enabled: () => dirty && !allowed.current,
  });
  function confirm(action: () => void) {
    if (dirty) setPending(() => action);
    else action();
  }
  function leave() {
    if (pending) {
      const action = pending;
      setPending(null);
      allowed.current = true;
      action();
      setTimeout(() => {
        allowed.current = false;
      }, 0);
    } else guard.accept();
  }
  const actions = useContext(DirtyActionsContext);
  useEffect(() => {
    if (!dirty) return;
    const handler = (action: () => void) => setPending(() => action);
    actions.add(handler);
    return () => {
      actions.delete(handler);
    };
  }, [dirty, actions]);
  const dialog = (
    <Modal
      open={guard.active || !!pending}
      onOpenChange={(open) => {
        if (!open) {
          setPending(null);
          guard.reject();
        }
      }}
      title="Discard unsaved changes?"
      description="Your changes have not been saved. Stay to save them, or leave and discard them."
    >
      <div className="flex flex-wrap justify-end gap-space-xs">
        <Button
          variant="secondary"
          onClick={() => {
            setPending(null);
            guard.reject();
          }}
        >
          Keep editing
        </Button>
        <Button variant="danger" onClick={leave}>
          Discard changes
        </Button>
      </div>
    </Modal>
  );
  return {
    confirm,
    dialog,
    afterSave: (action: () => void) => {
      allowed.current = true;
      action();
    },
  };
}
