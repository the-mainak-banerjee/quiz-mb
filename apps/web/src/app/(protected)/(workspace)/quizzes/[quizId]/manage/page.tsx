import { PublishedQuizManagement } from '@/features/publishing/published-quiz-management';
import type { PublishedQuizViewModel } from '@/features/publishing/mock-data';
import { APP_LINKS } from '@/config/navigation';
import { loadApi } from '@/lib/api/server';
import type {
  HostRegistrationDto,
  PublicQuizDto,
  QuizDto,
} from '@quizmb/contracts';
import { headers } from 'next/headers';
import { getInitials } from '@/lib/utils';
import { API_ROUTES } from '@/lib/api/routes';

export default async function ManagePublishedQuizPage({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') ?? 'quizmb.com';
  const protocol =
    requestHeaders.get('x-forwarded-proto') ??
    (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  const appOrigin = `${protocol}://${host}`;
  const quiz = await loadApi<QuizDto>(API_ROUTES.QUIZZES.DETAIL(quizId));
  const [publicQuiz, registrations] = await Promise.all([
    loadApi<PublicQuizDto>(`/api/public/quizzes/${quiz.publicId}`),
    loadApi<HostRegistrationDto[]>(
      API_ROUTES.QUIZZES.ALL_REGISTRATIONS(quizId),
    ),
  ]);
  const planned = quiz.plannedStartAt ? new Date(quiz.plannedStartAt) : null;
  const viewQuiz: PublishedQuizViewModel = {
    id: quiz.id,
    slug: quiz.publicId,
    title: quiz.title,
    description: quiz.description,
    project: quiz.projectName,
    host: 'You',
    hostRole: 'Quiz host',
    plannedStartAt: quiz.plannedStartAt ?? '',
    date: planned
      ? planned.toLocaleDateString(undefined, {
          weekday: 'long',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })
      : 'Not scheduled',
    dateTileMonth: planned
      ? planned.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()
      : '',
    dateTileDay: planned
      ? planned.toLocaleDateString(undefined, { day: 'numeric' })
      : '',
    time: planned
      ? planned.toLocaleTimeString(undefined, {
          hour: 'numeric',
          minute: '2-digit',
          timeZoneName: 'short',
        })
      : '',
    cover: quiz.cover,
    registrationLimit: quiz.registrationLimit,
    registeredCount: publicQuiz.registrationCount,
    publicUrl: `${appOrigin}${APP_LINKS.PUBLIC_QUIZ(quiz.publicId)}`,
    outline: [],
  };

  return (
    <PublishedQuizManagement
      quiz={viewQuiz}
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
