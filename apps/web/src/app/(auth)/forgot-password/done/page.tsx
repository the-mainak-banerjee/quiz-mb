import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { APP_LINKS } from '@/config/navigation';
import { currentUser } from '@/lib/auth/session';
import { ResetDoneView } from '@/features/auth/password-reset';

export const metadata: Metadata = {
  title: 'Password Reset Complete',
  description:
    'Your password has been reset. Sign in again to continue with QuizMB.',
};

export default async function ResetDonePage() {
  if (await currentUser(false)) redirect(APP_LINKS.WORKSPACE.DASHBOARD);
  return <ResetDoneView />;
}
