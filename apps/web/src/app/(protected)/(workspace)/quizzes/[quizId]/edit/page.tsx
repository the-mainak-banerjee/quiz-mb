import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { QUIZ_STATUS, type QuizDto } from '@quizmb/contracts';
import { APP_LINKS } from '@/config/navigation';
import { loadApi } from '@/lib/api/server';
import { QuizEditor } from '@/features/quiz-builder/quiz-editor';
export default async function EditQuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { quizId } = await params;
  if (!z.uuid().safeParse(quizId).success) notFound();
  const quiz = await loadApi<QuizDto>(`/api/quizzes/${quizId}`);
  // A completed quiz can no longer change: it is only viewed.
  if (quiz.status === QUIZ_STATUS.COMPLETED)
    redirect(APP_LINKS.WORKSPACE.VIEW_QUIZ(quizId));
  const { step } = await searchParams;
  return (
    <QuizEditor
      project={{ id: quiz.projectId, name: quiz.projectName }}
      initial={quiz}
      initialStep={step === 'questions' || step === 'review' ? step : 'details'}
    />
  );
}
