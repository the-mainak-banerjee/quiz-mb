import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { APP_LINKS } from '@/config/navigation';
import { currentUser } from '@/lib/auth/session';
import { NewPassword } from '@/features/auth/password-reset';

export const metadata: Metadata = {
  title: 'Choose a New Password',
  description: 'Set a new password for your QuizMB account.',
};

export default async function NewPasswordPage() {
  if (await currentUser(false)) redirect(APP_LINKS.WORKSPACE.DASHBOARD);
  return <NewPassword />;
}
