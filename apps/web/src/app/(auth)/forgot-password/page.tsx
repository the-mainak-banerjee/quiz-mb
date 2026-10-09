import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { APP_LINKS } from '@/config/navigation';
import { currentUser } from '@/lib/auth/session';
import { ForgotPasswordView } from '@/features/auth/password-reset';

export const metadata: Metadata = {
  title: 'Reset Password',
  description: 'Request a verification code to reset your QuizMB password.',
};

export default async function ForgotPasswordPage() {
  if (await currentUser(false)) redirect(APP_LINKS.WORKSPACE.DASHBOARD);
  return <ForgotPasswordView />;
}
