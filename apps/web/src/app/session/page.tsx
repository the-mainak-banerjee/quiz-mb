import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { ContinueSession } from '@/features/auth/continue-session';
import { Text } from '@/components/ui';

export default async function SessionPage() {
  if (await currentUser(false)) redirect('/');
  return (
    <main className="mx-auto max-w-content px-margin-sm py-space-2xl space-y-space-md">
      <Text as="h1" variant="page-title">
        Continue your session
      </Text>
      <Text tone="secondary">Securely renew your session to continue.</Text>
      <ContinueSession />
    </main>
  );
}
