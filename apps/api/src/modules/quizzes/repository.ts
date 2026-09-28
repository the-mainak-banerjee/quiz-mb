import { randomBytes } from 'node:crypto';
import { Prisma, type PrismaClient } from '@quizmb/database';
import type { QuizInput } from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';

export const quizInclude = {
  project: true,
  cover: true,
  questions: {
    orderBy: { position: 'asc' },
    include: { image: true, options: { orderBy: { position: 'asc' } } },
  },
} satisfies Prisma.QuizInclude;
export type QuizRow = Prisma.QuizGetPayload<{ include: typeof quizInclude }>;
export async function lockEditableQuiz(
  tx: Prisma.TransactionClient,
  id: string,
  userId: string,
) {
  await tx.$queryRaw`SELECT id FROM quizzes WHERE id = ${id}::uuid FOR UPDATE`;
  const quiz = await tx.quiz.findFirst({
    where: { id, creatorUserId: userId, project: { ownerUserId: userId } },
  });
  if (!quiz) throw new ApiError(404, 'NOT_FOUND', 'Quiz not found.');
  if (['LIVE', 'COMPLETED'].includes(quiz.status))
    throw new ApiError(
      409,
      'QUIZ_LOCKED',
      'This quiz can no longer be edited.',
    );
  return quiz;
}
export async function validateMedia(
  tx: Prisma.TransactionClient,
  id: string | null,
  quizId: string,
  userId: string,
  purpose: 'QUIZ_COVER' | 'QUESTION_IMAGE',
) {
  if (
    id &&
    !(await tx.mediaAsset.findFirst({
      where: { id, quizId, ownerUserId: userId, purpose, status: 'READY' },
    }))
  )
    throw new ApiError(
      422,
      'VALIDATION_ERROR',
      'Choose a completed image upload belonging to this quiz.',
    );
}
export class QuizzesRepository {
  constructor(readonly db: PrismaClient) {}
  get(id: string, userId: string) {
    return this.db.quiz.findFirst({
      where: { id, creatorUserId: userId, project: { ownerUserId: userId } },
      include: quizInclude,
    });
  }
  list(projectId: string, userId: string, cursor?: string) {
    return this.db.quiz.findMany({
      where: {
        projectId,
        creatorUserId: userId,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: 26,
      include: { _count: { select: { questions: true } } },
    });
  }
  create(projectId: string, userId: string, input: QuizInput) {
    return this.db.$transaction(async (tx) => {
      if (
        !(await tx.project.findFirst({
          where: { id: projectId, ownerUserId: userId },
        }))
      )
        throw new ApiError(404, 'NOT_FOUND', 'Project not found.');
      if (input.coverMediaId)
        throw new ApiError(
          422,
          'VALIDATION_ERROR',
          'Save the quiz before uploading its cover.',
        );
      return tx.quiz.create({
        data: {
          ...input,
          projectId,
          creatorUserId: userId,
          publicId: randomBytes(12).toString('base64url'),
        },
        include: quizInclude,
      });
    });
  }
  update(id: string, userId: string, input: QuizInput) {
    return this.db.$transaction(async (tx) => {
      await lockEditableQuiz(tx, id, userId);
      await validateMedia(tx, input.coverMediaId, id, userId, 'QUIZ_COVER');
      return tx.quiz.update({
        where: { id },
        data: input,
        include: quizInclude,
      });
    });
  }
}
