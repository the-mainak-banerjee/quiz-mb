import type { ParticipantQuizResultDto } from '@quizmb/contracts';
import { ParticipantSummary } from '@/features/results/participant-summary';
import { API_ROUTES } from '@/lib/api/routes';
import { loadApi } from '@/lib/api/server';

// A participant's completed quiz summary; the API returns 404 to anyone who
// was not registered for it.
export default async function HistoryResultPage({
  params,
}: {
  params: Promise<{ liveSessionId: string }>;
}) {
  const { liveSessionId } = await params;
  const data = await loadApi<ParticipantQuizResultDto>(
    API_ROUTES.LIVE_SESSIONS.MY_RESULT(liveSessionId),
  );
  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col px-margin-sm py-space-lg md:px-margin lg:px-space-xl">
      <ParticipantSummary data={data} />
    </main>
  );
}
