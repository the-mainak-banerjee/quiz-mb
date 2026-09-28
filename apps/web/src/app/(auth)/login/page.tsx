import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { AuthPage } from '@/features/auth/auth-page';
import { safeReturnTo } from '@/lib/auth/return-to';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  if (await currentUser(false)) redirect(returnTo);
  return <AuthPage mode="login" returnTo={returnTo} />;
}
