import { redirect } from 'next/navigation';
import type { ActiveHostSessionDto } from '@quizmb/contracts';
import { APP_LINKS } from '@/config/navigation';
import { HostLiveConflict } from '@/features/live-session/host-live-conflict';
import { API_ROUTES } from '@/lib/api/routes';
import { loadApi } from '@/lib/api/server';

function openedLabel(createdAt: string) {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - Date.parse(createdAt)) / 60_000),
  );
  if (minutes < 1) return 'Opened just now';
  if (minutes < 60) return `Opened ${minutes}m ago`;
  return `Opened ${Math.round(minutes / 60)}h ago`;
}

// Shown when opening a lobby is refused because another quiz is live.
export default async function LiveConflictPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const active = await loadApi<ActiveHostSessionDto | null>(
    API_ROUTES.LIVE_SESSIONS.ACTIVE,
  );
  if (!active) redirect(APP_LINKS.WORKSPACE.MANAGE_QUIZ(quizId));
  if (active.quizId === quizId) redirect(APP_LINKS.WORKSPACE.LIVE_QUIZ(quizId));

  return (
    <HostLiveConflict
      activeQuizTitle={active.quizTitle}
      activeProjectName={active.projectName}
      startedLabel={openedLabel(active.createdAt)}
      stageLabel={active.state === 'LOBBY' ? 'Lobby open' : 'Quiz live'}
      connected={active.connected}
      registered={active.registered}
      asked={0}
      questionCount={active.questionCount}
      waiting={[]}
      returnHref={APP_LINKS.WORKSPACE.LIVE_QUIZ(active.quizId)}
      backHref={APP_LINKS.WORKSPACE.MANAGE_QUIZ(quizId)}
    />
  );
}
