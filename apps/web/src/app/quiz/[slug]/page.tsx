import { PublicQuizView } from '@/features/publishing/public-quiz-view';
import type { PublicQuizState } from '@/features/publishing/types';
import { toPublishedQuizViewModel } from '@/features/publishing/view-model';
import { currentUser } from '@/lib/auth/session';
import type { Metadata } from 'next';
import { serverApi } from '@/lib/api/server';
import { getPublicQuiz } from '@/lib/api/public-quiz';
import { NO_INDEX, sharingMetadata } from '@/config/seo';
import { getAppOrigin } from '@/lib/app-origin';
import { API_ROUTES } from '@/lib/api/routes';
import { QUIZ_STATUS, type RegistrationDto } from '@quizmb/contracts';

type QuizPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: QuizPageProps): Promise<Metadata> {
  const { slug } = await params;
  let title = 'Quiz Invitation';
  let description =
    'View a shared QuizMB quiz invitation. Sign in to register and participate.';
  try {
    const quiz = await getPublicQuiz(slug);
    // Whitelist public copy only: never questions, answers, or roster data.
    title = quiz.title;
    description =
      quiz.description.trim().replace(/\s+/g, ' ').slice(0, 200) || description;
  } catch {
    // The layout already sends unknown quizzes to a 404; on an API hiccup
    // the preview keeps the generic invitation text.
  }
  return {
    title,
    description,
    robots: NO_INDEX,
    ...sharingMetadata({
      title: `${title} | QuizMB`,
      description,
      path: `/quiz/${encodeURIComponent(slug)}`,
    }),
  };
}

export default async function PublicQuizPage({ params }: QuizPageProps) {
  const { slug } = await params;
  const [quiz, user, appOrigin] = await Promise.all([
    getPublicQuiz(slug),
    currentUser(false),
    getAppOrigin(),
  ]);
  const registration = user
    ? await (
        await serverApi()
      ).get<RegistrationDto>(API_ROUTES.QUIZZES.REGISTRATION(quiz.id))
    : null;
  const isHost = user?.id === quiz.host.id;
  // Registration stays open while the lobby is open; registered
  // participants keep their panel (with the live-room link) once live.
  const initialState: PublicQuizState =
    !isHost && registration?.registered
      ? 'registered'
      : quiz.status === QUIZ_STATUS.COMPLETED
        ? 'completed'
        : quiz.status !== QUIZ_STATUS.PUBLISHED &&
            quiz.status !== QUIZ_STATUS.LOBBY
          ? 'closed'
          : quiz.isFull
            ? 'full'
            : user
              ? 'open'
              : 'logged-out';

  return (
    <PublicQuizView
      quiz={toPublishedQuizViewModel(quiz, appOrigin)}
      initialState={initialState}
      resultSessionId={
        isHost ? null : (registration?.completedLiveSessionId ?? null)
      }
      user={user}
      isHost={isHost}
    />
  );
}
