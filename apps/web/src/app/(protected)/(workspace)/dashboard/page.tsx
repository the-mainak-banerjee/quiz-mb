import { requireUser } from '@/lib/auth/session';
import { DashboardView } from '@/features/dashboard/dashboard-view';

export default async function DashboardPage() {
  const user = await requireUser();
  return <DashboardView user={user} />;
}
