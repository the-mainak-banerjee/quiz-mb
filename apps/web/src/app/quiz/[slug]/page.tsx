import { PublicQuizView } from '@/features/publishing/public-quiz-view';
import type { PublicQuizState } from '@/features/publishing/types';
import { toPublishedQuizViewModel } from '@/features/publishing/view-model';
import { currentUser } from '@/lib/auth/session';
import { loadApi, serverApi } from '@/lib/api/server';
import { getAppOrigin } from '@/lib/app-origin';
import { API_ROUTES } from '@/lib/api/routes';
import type { PublicQuizDto, RegistrationDto } from '@quizmb/contracts';

export default async function PublicQuizPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [quiz, user, appOrigin] = await Promise.all([
    loadApi<PublicQuizDto>(API_ROUTES.PUBLIC_QUIZ(slug)),
    currentUser(false),
    getAppOrigin(),
  ]);
  const registration = user
    ? await (
        await serverApi()
      ).get<RegistrationDto>(`/api/quizzes/${quiz.id}/registration`)
    : null;
  const isHost = user?.id === quiz.host.id;
  const initialState: PublicQuizState =
    quiz.status !== 'PUBLISHED'
      ? 'closed'
      : !isHost && registration?.registered
        ? 'registered'
        : quiz.isFull
          ? 'full'
          : user
            ? 'open'
            : 'logged-out';

  return (
    <PublicQuizView
      quiz={toPublishedQuizViewModel(quiz, appOrigin)}
      initialState={initialState}
      user={user}
      isHost={isHost}
    />
  );
}
