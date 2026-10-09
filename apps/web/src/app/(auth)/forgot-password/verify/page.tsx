import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { APP_LINKS } from '@/config/navigation';
import { currentUser } from '@/lib/auth/session';
import { ResetCode } from '@/features/auth/password-reset';

export const metadata: Metadata = {
  title: 'Verify Reset Code',
  description:
    'Verify your password reset code to recover your QuizMB account.',
};

export default async function ResetCodePage() {
  if (await currentUser(false)) redirect(APP_LINKS.WORKSPACE.DASHBOARD);
  return <ResetCode />;
}
