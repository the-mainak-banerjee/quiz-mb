import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { APP_LINKS } from '@/config/navigation';
import { currentUser } from '@/lib/auth/session';
import { VerifyEmail } from '@/features/auth/verify-email-view';

export const metadata: Metadata = {
  title: 'Verify Email',
  description: 'Verify your email address to activate your QuizMB account.',
};

export default async function VerifyEmailPage() {
  if (await currentUser(false)) redirect(APP_LINKS.WORKSPACE.DASHBOARD);
  return <VerifyEmail />;
}
