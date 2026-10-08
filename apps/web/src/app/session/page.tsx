import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { safeReturnTo } from '@/lib/auth/return-to';
import { SessionRecovery } from '@/features/auth/session-recovery';

/**
 * Where a page that found the access token expired sends the visitor: the
 * browser renews the session and goes straight back to `returnTo`.
 */
export default async function SessionPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  // Renewed in another tab meanwhile: nothing to do.
  if (await currentUser(false)) redirect(returnTo);
  return <SessionRecovery returnTo={returnTo} />;
}
