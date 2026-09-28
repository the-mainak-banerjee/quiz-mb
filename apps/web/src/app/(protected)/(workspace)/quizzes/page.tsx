import { QuizzesView } from '@/features/dashboard/quizzes-view';
import { loadUserQuizData } from '@/features/dashboard/quiz-data';

export default async function QuizzesPage() {
  const { quizzes } = await loadUserQuizData();

  return (
    <main className="mx-auto flex w-full max-w-content flex-1 flex-col space-y-space-lg px-margin-sm py-space-lg md:px-margin lg:px-space-xl">
      <QuizzesView quizzes={quizzes} />
    </main>
  );
}
