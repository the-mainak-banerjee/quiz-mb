import { PublishedQuizManagement } from '@/features/publishing/published-quiz-management';
import { toPublishedQuizViewModel } from '@/features/publishing/view-model';
import { loadApi } from '@/lib/api/server';
import type {
  HostRegistrationDto,
  PublicQuizDto,
  QuizDto,
} from '@quizmb/contracts';
import { getAppOrigin } from '@/lib/app-origin';
import { getInitials } from '@/lib/utils';
import { API_ROUTES } from '@/lib/api/routes';

export default async function ManagePublishedQuizPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  // The owner-only host read authorizes management before public data loads.
  const quiz = await loadApi<QuizDto>(API_ROUTES.QUIZZES.DETAIL(quizId));
  const [publicQuiz, registrations, appOrigin] = await Promise.all([
    loadApi<PublicQuizDto>(API_ROUTES.PUBLIC_QUIZ(quiz.publicId)),
    loadApi<HostRegistrationDto[]>(
      API_ROUTES.QUIZZES.ALL_REGISTRATIONS(quizId),
    ),
    getAppOrigin(),
  ]);

  return (
    <PublishedQuizManagement
      quiz={toPublishedQuizViewModel(publicQuiz, appOrigin)}
      participants={registrations.map((registration) => ({
        id: registration.id,
        initials: getInitials(registration.name),
        name: registration.name,
        registeredAt: registration.registeredAt,
        detail: `Registered ${new Date(registration.registeredAt).toLocaleString()}`,
      }))}
    />
  );
}
