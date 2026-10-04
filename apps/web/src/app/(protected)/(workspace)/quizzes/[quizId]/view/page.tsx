import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { EDIT_SCOPE, isEditLocked, type QuizDto } from '@quizmb/contracts';
import { APP_LINKS } from '@/config/navigation';
import { loadApi } from '@/lib/api/server';
import { QuizEditor } from '@/features/quiz-builder/quiz-editor';

/** A live or completed quiz's details and questions, read only. */
export default async function ViewQuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { quizId } = await params;
  if (!z.uuid().safeParse(quizId).success) notFound();
  const quiz = await loadApi<QuizDto>(`/api/quizzes/${quizId}`);
  if (!isEditLocked(quiz.status, EDIT_SCOPE.DETAILS))
    redirect(APP_LINKS.WORKSPACE.EDIT_QUIZ(quizId));
  const { step } = await searchParams;
  return (
    <QuizEditor
      project={{ id: quiz.projectId, name: quiz.projectName }}
      initial={quiz}
      initialStep={step === 'questions' ? step : 'details'}
      readOnly
    />
  );
}
