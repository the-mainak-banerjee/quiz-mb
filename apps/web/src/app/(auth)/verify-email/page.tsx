import { redirect } from 'next/navigation';
import { APP_LINKS } from '@/config/navigation';
import { currentUser } from '@/lib/auth/session';
import { VerifyEmail } from '@/features/auth/verify-email-view';

export default async function VerifyEmailPage() {
  if (await currentUser(false)) redirect(APP_LINKS.WORKSPACE.DASHBOARD);
  return <VerifyEmail />;
}
