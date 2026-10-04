import { Prisma, type PrismaClient } from '@quizmb/database';
import {
  AUTHORING_LIMITS,
  type QuestionInput,
  ERROR_CODE,
  MEDIA_PURPOSE,
  QUIZ_STATUS,
} from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';
import { lockedTransaction } from '../../infrastructure/transactions.js';
import { lockEditableQuiz, validateMedia } from '../quizzes/repository.js';
import { EDIT_SCOPE } from '../quizzes/constants.js';

async function setPositions(
  tx: Prisma.TransactionClient,
  quizId: string,
  ids: string[],
) {
  if (!ids.length) return;
  // Two non-overlapping ranges preserve the unique index without one round-trip
  // per question. The parent quiz lock serializes all authoring mutations.
  await tx.question.updateMany({
    where: { quizId },
    data: { position: { increment: AUTHORING_LIMITS.questions + 1 } },
  });
  const positions = Prisma.join(
    ids.map((id, position) => Prisma.sql`(${id}::uuid, ${position}::integer)`),
  );
  await tx.$executeRaw(
    Prisma.sql`UPDATE questions AS q SET position = v.position FROM (VALUES ${positions}) AS v(id, position) WHERE q.id = v.id AND q."quizId" = ${quizId}::uuid`,
  );
}

export class QuestionsRepository {
  constructor(private db: PrismaClient) {}
  async save(
    quizId: string,
    userId: string,
    input: QuestionInput,
    questionId?: string,
  ) {
    return this.db.$transaction(async (tx) => {
      await lockEditableQuiz(tx, quizId, userId, EDIT_SCOPE.QUESTIONS);
      await validateMedia(
        tx,
        input.imageMediaId,
        quizId,
        userId,
        MEDIA_PURPOSE.QUESTION_IMAGE,
      );
      const { options, ...data } = input;
      if (questionId) {
        if (
          !(await tx.question.findFirst({ where: { id: questionId, quizId } }))
        )
          throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Question not found.');
        await tx.questionOption.deleteMany({ where: { questionId } });
        await tx.question.update({
          where: { id: questionId },
          data: {
            ...data,
            options: {
              create: options.map((o, position) => ({ ...o, position })),
            },
          },
        });
      } else {
        const count = await tx.question.count({ where: { quizId } });
        if (count >= AUTHORING_LIMITS.questions)
          throw new ApiError(
            422,
            ERROR_CODE.VALIDATION_ERROR,
            'Question limit reached.',
          );
        await tx.question.create({
          data: {
            ...data,
            quizId,
            position: count,
            options: {
              create: options.map((o, position) => ({ ...o, position })),
            },
          },
        });
      }
      await tx.quiz.update({
        where: { id: quizId },
        data: { updatedAt: new Date() },
      });
    }, lockedTransaction);
  }
  async quizForQuestion(id: string, userId: string) {
    const q = await this.db.question.findFirst({
      where: {
        id,
        quiz: { creatorUserId: userId, project: { ownerUserId: userId } },
      },
      select: { quizId: true },
    });
    if (!q)
      throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Question not found.');
    return q.quizId;
  }
  async remove(id: string, quizId: string, userId: string) {
    await this.db.$transaction(async (tx) => {
      const quiz = await lockEditableQuiz(
        tx,
        quizId,
        userId,
        EDIT_SCOPE.QUESTIONS,
      );
      await tx.question.deleteMany({ where: { id, quizId } });
      const remaining = await tx.question.findMany({
        where: { quizId },
        orderBy: { position: 'asc' },
      });
      // A published quiz stays publishable: it keeps at least one question.
      if (!remaining.length && quiz.status !== QUIZ_STATUS.DRAFT) {
        const message = 'A published quiz needs at least one question.';
        throw new ApiError(422, ERROR_CODE.VALIDATION_ERROR, message, {
          questions: message,
        });
      }
      await setPositions(
        tx,
        quizId,
        remaining.map((q) => q.id),
      );
      await tx.quiz.update({
        where: { id: quizId },
        data: { updatedAt: new Date() },
      });
    }, lockedTransaction);
  }
  async reorder(quizId: string, userId: string, ids: string[]) {
    await this.db.$transaction(async (tx) => {
      await lockEditableQuiz(tx, quizId, userId, EDIT_SCOPE.QUESTIONS);
      const all = await tx.question.findMany({
        where: { quizId },
        select: { id: true },
      });
      if (
        new Set(ids).size !== ids.length ||
        all.length !== ids.length ||
        all.some((q) => !ids.includes(q.id))
      )
        throw new ApiError(
          422,
          ERROR_CODE.VALIDATION_ERROR,
          'Include every question exactly once.',
        );
      await setPositions(tx, quizId, ids);
      await tx.quiz.update({
        where: { id: quizId },
        data: { updatedAt: new Date() },
      });
    }, lockedTransaction);
  }
}
