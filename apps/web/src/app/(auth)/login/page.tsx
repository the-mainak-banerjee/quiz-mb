import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { AuthPage } from '@/features/auth/auth-page';
import { safeReturnTo, SESSION_ENDED_PARAM } from '@/lib/auth/return-to';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; [SESSION_ENDED_PARAM]?: string }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  if (await currentUser(false)) redirect(returnTo);
  return (
    <AuthPage
      mode="login"
      returnTo={returnTo}
      sessionEnded={params[SESSION_ENDED_PARAM] === '1'}
    />
  );
}
