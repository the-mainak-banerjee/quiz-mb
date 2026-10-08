'use client';
import { useState } from 'react';
import { AlertTriangle, CheckCircle2, Trash2 } from 'lucide-react';
import { ACCOUNT_DELETE_CONFIRMATION } from '@quizmb/contracts';
import { Badge, Button, Callout, Input, Text } from '@/components/ui';
import { ConfirmDeleteModal } from '@/components/confirm-delete-modal';
import { PasswordField } from '@/features/auth/password-field';
import { APP_LINKS } from '@/config/navigation';
import { accountApi } from '@/lib/api/account';
import { ACCOUNT_DELETED_PARAM } from '@/lib/auth/return-to';
import { SettingsCard } from './settings-card';

/**
 * The danger zone. Deleting needs the word DELETE typed exactly and the
 * current password; the API refuses while the account hosts or is
 * registered for an unfinished quiz, and the modal shows why.
 */
export function DeleteAccount() {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [password, setPassword] = useState('');
  const matched = typed === ACCOUNT_DELETE_CONFIRMATION;
  function change(next: boolean) {
    setOpen(next);
    if (!next) {
      setTyped('');
      setPassword('');
    }
  }
  return (
    <SettingsCard
      title="Delete account"
      description="Permanently delete your QuizMB account and associated data. This action cannot be undone."
      eyebrow={
        <Badge
          variant="danger"
          dot={false}
          label={
            <span className="inline-flex items-center gap-1">
              <AlertTriangle size={14} aria-hidden="true" />
              Danger zone
            </span>
          }
        />
      }
      className="border-t-4 border-t-danger-surface"
    >
      <div>
        <Button
          variant="danger"
          icon={<Trash2 size={17} aria-hidden="true" />}
          onClick={() => setOpen(true)}
        >
          Delete account
        </Button>
      </div>
      <ConfirmDeleteModal
        open={open}
        onOpenChange={change}
        title="Delete your account?"
        description="This will permanently delete your QuizMB account and associated records. This action cannot be undone."
        confirmLabel="Delete account"
        confirmDisabled={!matched || !password}
        onConfirm={async () => {
          await accountApi.deleteAccount({
            confirmation: ACCOUNT_DELETE_CONFIRMATION,
            password,
          });
          // A full load: nothing of the deleted account stays in memory.
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.assign(
            `${APP_LINKS.AUTH.LOGIN}?${ACCOUNT_DELETED_PARAM}=1`,
          );
          // Keep the modal busy until the page leaves.
          await new Promise(() => {});
        }}
      >
        <div className="mb-space-md space-y-space-md">
          <Callout>
            Your projects, quizzes (with their questions, images and results),
            and your answers and results in other people’s quizzes will be
            removed. You can’t delete your account while you host a quiz that is
            published or live, or are registered for one that hasn’t finished.
          </Callout>
          <div className="space-y-space-xs">
            <div className="flex items-center justify-between gap-space-xs">
              <label htmlFor="delete-confirmation" className="text-label">
                To confirm, type{' '}
                <span className="font-semibold text-danger">
                  {ACCOUNT_DELETE_CONFIRMATION}
                </span>{' '}
                in the box below:
              </label>
              {matched && (
                <Text as="span" variant="caption" className="text-accent">
                  Matched
                </Text>
              )}
            </div>
            <div className="relative">
              <Input
                id="delete-confirmation"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                aria-describedby="delete-confirmation-hint"
                className="pr-space-2xl tracking-widest"
              />
              {matched && (
                <CheckCircle2
                  size={18}
                  aria-hidden="true"
                  className="absolute right-control-x top-1/2 -translate-y-1/2 text-accent"
                />
              )}
            </div>
            <Text
              id="delete-confirmation-hint"
              variant="caption"
              tone="secondary"
            >
              Case-sensitive verification safeguard.
            </Text>
          </div>
          <PasswordField
            id="delete-password"
            label="Your password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
      </ConfirmDeleteModal>
    </SettingsCard>
  );
}
