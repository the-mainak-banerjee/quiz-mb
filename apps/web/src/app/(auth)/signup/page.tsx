import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { currentUser } from '@/lib/auth/session';
import { AuthPage } from '@/features/auth/auth-page';
import { safeReturnTo } from '@/lib/auth/return-to';

export const metadata: Metadata = {
  title: 'Create Account',
  description: 'Create your QuizMB account to build and join live quizzes.',
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const returnTo = safeReturnTo((await searchParams).returnTo);
  if (await currentUser(false)) redirect(returnTo);
  return <AuthPage mode="signup" returnTo={returnTo} />;
}
