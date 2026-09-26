import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { AuthPage } from '@/features/auth/auth-page';
import { APP_LINKS } from '@/config/navigation';
export default async function SignupPage() {
  if (await currentUser(false)) redirect(APP_LINKS.WORKSPACE.DASHBOARD);
  return <AuthPage mode="signup" />;
}
