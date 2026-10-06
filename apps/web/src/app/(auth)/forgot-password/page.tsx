import { redirect } from 'next/navigation';
import { APP_LINKS } from '@/config/navigation';
import { currentUser } from '@/lib/auth/session';
import { ForgotPasswordView } from '@/features/auth/password-reset';

export default async function ForgotPasswordPage() {
  if (await currentUser(false)) redirect(APP_LINKS.WORKSPACE.DASHBOARD);
  return <ForgotPasswordView />;
}
