import { notFound } from 'next/navigation';
import { z } from 'zod';
import type { QuizDto } from '@quizmb/contracts';
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
  const { step } = await searchParams;
  return (
    <QuizEditor
      project={{ id: quiz.projectId, name: quiz.projectName }}
      initial={quiz}
      initialStep={step === 'questions' || step === 'review' ? step : 'details'}
    />
  );
}
