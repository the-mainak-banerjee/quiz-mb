import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { currentUser } from '@/lib/auth/session';
import { AuthPage } from '@/features/auth/auth-page';
import {
  ACCOUNT_DELETED_PARAM,
  safeReturnTo,
  SESSION_ENDED_PARAM,
} from '@/lib/auth/return-to';

export const metadata: Metadata = {
  title: 'Sign In',
  description:
    'Sign in to your QuizMB account to host quizzes and participate.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    returnTo?: string;
    [SESSION_ENDED_PARAM]?: string;
    [ACCOUNT_DELETED_PARAM]?: string;
  }>;
}) {
  const params = await searchParams;
  const returnTo = safeReturnTo(params.returnTo);
  if (await currentUser(false)) redirect(returnTo);
  const notice =
    params[ACCOUNT_DELETED_PARAM] === '1'
      ? 'Your account has been deleted.'
      : params[SESSION_ENDED_PARAM] === '1'
        ? 'Your session has ended. Please sign in again to continue.'
        : undefined;
  return <AuthPage mode="login" returnTo={returnTo} notice={notice} />;
}
