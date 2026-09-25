import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth/session';
import { AuthPage } from '@/features/auth/auth-page';
export default async function LoginPage() {
  if (await currentUser(false)) redirect('/');
  return <AuthPage mode="login" />;
}
