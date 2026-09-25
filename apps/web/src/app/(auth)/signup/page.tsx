import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { AuthPage } from '@/features/auth/auth-page';
export default async function SignupPage() {
  if (await currentUser(false)) redirect('/');
  return <AuthPage mode="signup" />;
}
