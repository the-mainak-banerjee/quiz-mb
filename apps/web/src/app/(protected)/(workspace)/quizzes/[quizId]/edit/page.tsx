import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { EDIT_SCOPE, isEditLocked, type QuizDto } from '@quizmb/contracts';
import { APP_LINKS } from '@/config/navigation';
import { loadApi } from '@/lib/api/server';
import { EDITOR_NOTICE, QuizEditor } from '@/features/quiz-builder/quiz-editor';
export default async function EditQuizPage({
  params,
  searchParams,
}: {
  params: Promise<{ quizId: string }>;
  searchParams: Promise<{ step?: string; notice?: string }>;
}) {
  const { quizId } = await params;
  if (!z.uuid().safeParse(quizId).success) notFound();
  const quiz = await loadApi<QuizDto>(`/api/quizzes/${quizId}`);
  // A live or completed quiz can no longer change: it is only viewed.
  if (isEditLocked(quiz.status, EDIT_SCOPE.DETAILS))
    redirect(APP_LINKS.WORKSPACE.VIEW_QUIZ(quizId));
  const { step, notice } = await searchParams;
  return (
    <QuizEditor
      project={{ id: quiz.projectId, name: quiz.projectName }}
      initial={quiz}
      initialStep={step === 'questions' || step === 'review' ? step : 'details'}
      notice={
        notice === EDITOR_NOTICE.COVER_FAILED
          ? EDITOR_NOTICE.COVER_FAILED
          : undefined
      }
    />
  );
}
