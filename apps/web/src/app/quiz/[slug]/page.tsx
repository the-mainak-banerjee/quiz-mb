import { PublicQuizView } from '@/features/publishing/public-quiz-view';
import type {
  PublicQuizState,
  PublishedQuizViewModel,
} from '@/features/publishing/mock-data';
import { currentUser } from '@/lib/auth/session';
import { loadApi, serverApi } from '@/lib/api/server';
import { APP_LINKS } from '@/config/navigation';
import type { PublicQuizDto, RegistrationDto } from '@quizmb/contracts';

export default async function PublicQuizPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [quiz, user] = await Promise.all([
    loadApi<PublicQuizDto>(`/api/public/quizzes/${encodeURIComponent(slug)}`),
    currentUser(false),
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
  const planned = new Date(quiz.plannedStartAt);
  const viewQuiz: PublishedQuizViewModel = {
    id: quiz.id,
    slug: quiz.publicId,
    title: quiz.title,
    description: quiz.description,
    project: quiz.project.name,
    host: quiz.host.name,
    hostRole: 'Quiz host',
    plannedStartAt: quiz.plannedStartAt,
    date: planned.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }),
    dateTileMonth: planned
      .toLocaleDateString(undefined, { month: 'short' })
      .toUpperCase(),
    dateTileDay: planned.toLocaleDateString(undefined, { day: 'numeric' }),
    time: planned.toLocaleTimeString(undefined, {
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    }),
    cover: quiz.cover,
    registrationLimit: quiz.registrationLimit,
    registeredCount: quiz.registrationCount,
    publicUrl: `quizmb.com${APP_LINKS.PUBLIC_QUIZ(quiz.publicId)}`,
    outline: [
      'Live knowledge challenge',
      'Synchronous participation',
      'Host-led debrief',
    ],
  };

  return (
    <PublicQuizView
      quiz={viewQuiz}
      initialState={initialState}
      user={user}
      isHost={isHost}
    />
  );
}
