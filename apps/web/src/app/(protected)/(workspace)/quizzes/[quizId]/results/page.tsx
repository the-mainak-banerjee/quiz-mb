import type { HostQuizResultsDto } from '@quizmb/contracts';
import { HostResultsView } from '@/features/results/host-results-view';
import { API_ROUTES } from '@/lib/api/routes';
import { loadApi } from '@/lib/api/server';

// Host results of a completed quiz; the API returns 404 to anyone else.
export default async function QuizResultsPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const initial = await loadApi<HostQuizResultsDto>(
    API_ROUTES.QUIZZES.RESULTS(quizId),
  );
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col px-margin-sm py-space-lg md:px-margin lg:px-space-xl">
      <HostResultsView initial={initial} />
    </main>
  );
}
