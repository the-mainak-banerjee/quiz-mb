import type { ParticipantDashboardDto } from '@quizmb/contracts';
import { HistoryView } from '@/features/results/history-view';
import { API_ROUTES } from '@/lib/api/routes';
import { loadApi } from '@/lib/api/server';

// Completed quizzes the signed-in user registered for, with final results.
export default async function HistoryPage() {
  const { history } = await loadApi<ParticipantDashboardDto>(
    API_ROUTES.DASHBOARD.PARTICIPANT,
  );
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col px-margin-sm py-space-lg md:px-margin lg:px-space-xl">
      <HistoryView items={history} />
    </main>
  );
}
