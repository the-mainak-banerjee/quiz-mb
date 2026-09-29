import { notFound, redirect } from 'next/navigation';
import type { LiveSessionRefDto, QuizDto } from '@quizmb/contracts';
import { APP_LINKS } from '@/config/navigation';
import { HostLiveConsole } from '@/features/live-session/host-live-console';
import { LiveSessionShell } from '@/features/live-session/live-session-shell';
import { ApiError } from '@/lib/api/client';
import { API_ROUTES } from '@/lib/api/routes';
import { loadApi, serverApi } from '@/lib/api/server';
import { getAppOrigin } from '@/lib/app-origin';

// Host live console. The session itself is loaded over Socket.IO; this page
// only resolves which session belongs to the quiz and confirms the host role.
export default async function HostLivePage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const manageHref = APP_LINKS.WORKSPACE.MANAGE_QUIZ(quizId);
  let session: LiveSessionRefDto;
  try {
    session = await (
      await serverApi()
    ).get<LiveSessionRefDto>(API_ROUTES.QUIZZES.LIVE_SESSION(quizId));
  } catch (error) {
    if (error instanceof ApiError && [403, 404].includes(error.status))
      redirect(manageHref);
    if (error instanceof ApiError && error.status === 401)
      redirect(APP_LINKS.AUTH.LOGIN);
    throw error;
  }
  if (session.role !== 'HOST') notFound();
  const [quiz, appOrigin] = await Promise.all([
    loadApi<QuizDto>(API_ROUTES.QUIZZES.DETAIL(quizId)),
    getAppOrigin(),
  ]);

  return (
    <LiveSessionShell exitHref={manageHref}>
      <HostLiveConsole
        liveSessionId={session.id}
        quizId={quizId}
        publicUrl={`${appOrigin}${APP_LINKS.PUBLIC_QUIZ(quiz.publicId)}`}
      />
    </LiveSessionShell>
  );
}
