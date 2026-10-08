import { redirect } from 'next/navigation';
import type { LiveSessionRefDto, PublicQuizDto } from '@quizmb/contracts';
import { APP_LINKS } from '@/config/navigation';
import { LiveSessionShell } from '@/features/live-session/live-session-shell';
import { ParticipantLiveView } from '@/features/live-session/participant-live-view';
import { ApiError } from '@/lib/api/client';
import { API_ROUTES } from '@/lib/api/routes';
import { loadApi, serverApi } from '@/lib/api/server';
import { authLink } from '@/lib/auth/return-to';
import { redirectUnauthenticated } from '@/lib/auth/recovery';
import { currentUser } from '@/lib/auth/session';

// Participant live room. Registration, late-join and one-device rules are
// enforced by the API when the socket joins; this page only routes the user.
export default async function ParticipantLivePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const quizHref = APP_LINKS.PUBLIC_QUIZ(slug);
  const user = await currentUser();
  if (!user)
    redirect(authLink(APP_LINKS.AUTH.LOGIN, APP_LINKS.PUBLIC_QUIZ_LIVE(slug)));
  const quiz = await loadApi<PublicQuizDto>(API_ROUTES.PUBLIC_QUIZ(slug));
  if (quiz.host.id === user.id)
    redirect(APP_LINKS.WORKSPACE.LIVE_QUIZ(quiz.id));

  let session: LiveSessionRefDto;
  try {
    session = await (
      await serverApi()
    ).get<LiveSessionRefDto>(API_ROUTES.QUIZZES.LIVE_SESSION(quiz.id));
  } catch (error) {
    if (error instanceof ApiError && [403, 404].includes(error.status))
      redirect(quizHref);
    if (error instanceof ApiError && error.status === 401)
      await redirectUnauthenticated(error.code);
    throw error;
  }

  return (
    <LiveSessionShell exitHref={quizHref}>
      <ParticipantLiveView
        liveSessionId={session.id}
        participantId={user.id}
        participantName={user.name}
        quizHref={quizHref}
        quiz={{
          id: quiz.id,
          publicId: quiz.publicId,
          title: quiz.title,
          projectName: quiz.project.name,
          hostName: quiz.host.name,
          plannedStartAt: quiz.plannedStartAt,
          registrationLimit: quiz.registrationLimit,
          questionCount: quiz.questionCount,
          // Not shown to participants; replaced by the live snapshot.
          defaultQuestionDurationSeconds: 0,
        }}
      />
    </LiveSessionShell>
  );
}
