import { redirect } from 'next/navigation';
import { APP_LINKS } from '@/config/navigation';
import { currentUser } from '@/lib/auth/session';
import { ResetDoneView } from '@/features/auth/password-reset';

export default async function ResetDonePage() {
  if (await currentUser(false)) redirect(APP_LINKS.WORKSPACE.DASHBOARD);
  return <ResetDoneView />;
}
