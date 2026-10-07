import { randomBytes, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@quizmb/database';
import { ApiError } from '../../http/api-error.js';
import { lockedTransaction } from '../../infrastructure/transactions.js';
import {
  lockAccount,
  recordUsage,
  requireAllowance,
} from '../usage/allowances.js';
import {
  PUBLIC_QUIZ_STATUSES,
  type MediaPurpose,
  type QuizInput,
  EDIT_SCOPE,
  ERROR_CODE,
  MEDIA_PURPOSE,
  isEditLocked,
  type EditScope,
  MEDIA_STATUS,
  QUIZ_STATUS,
  REGISTRATION_STATUS,
} from '@quizmb/contracts';

export const quizInclude = {
  project: true,
  cover: true,
  questions: {
    orderBy: { position: 'asc' },
    include: { image: true, options: { orderBy: { position: 'asc' } } },
  },
  _count: {
    select: {
      registrations: { where: { status: REGISTRATION_STATUS.REGISTERED } },
    },
  },
} satisfies Prisma.QuizInclude;
export type QuizRow = Prisma.QuizGetPayload<{ include: typeof quizInclude }>;
export const publicQuizInclude = {
  project: { select: { id: true, name: true } },
  creator: { select: { id: true, name: true } },
  cover: true,
  _count: {
    select: {
      registrations: { where: { status: REGISTRATION_STATUS.REGISTERED } },
      questions: true,
    },
  },
} satisfies Prisma.QuizInclude;
export type PublicQuizRow = Prisma.QuizGetPayload<{
  include: typeof publicQuizInclude;
}>;
/**
 * Locks the quiz row (the same lock registration takes) and checks the
 * owner may still change `scope`: questions are fixed once the lobby opens,
 * details once the quiz goes live.
 */
export async function lockEditableQuiz(
  tx: Prisma.TransactionClient,
  id: string,
  userId: string,
  scope: EditScope = EDIT_SCOPE.DETAILS,
) {
  await tx.$queryRaw`SELECT id FROM quizzes WHERE id = ${id}::uuid FOR UPDATE`;
  const quiz = await tx.quiz.findFirst({
    where: { id, creatorUserId: userId, project: { ownerUserId: userId } },
  });
  if (!quiz) throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Quiz not found.');
  if (isEditLocked(quiz.status, scope))
    throw new ApiError(
      409,
      ERROR_CODE.QUIZ_LOCKED,
      scope === EDIT_SCOPE.QUESTIONS && quiz.status === QUIZ_STATUS.LOBBY
        ? 'Questions cannot change once the lobby is open.'
        : 'This quiz can no longer be edited.',
    );
  return quiz;
}

/** Media of this purpose belongs to the questions or to the quiz details. */
export const mediaEditScope = (purpose: MediaPurpose) =>
  purpose === MEDIA_PURPOSE.QUESTION_IMAGE
    ? EDIT_SCOPE.QUESTIONS
    : EDIT_SCOPE.DETAILS;
/**
 * The image being attached must belong to this quiz and purpose. A PENDING
 * upload is accepted only when its stored file was just verified
 * (`MediaService.verifyPending`), and it becomes READY here.
 */
export async function validateMedia(
  tx: Prisma.TransactionClient,
  id: string | null,
  quizId: string,
  userId: string,
  purpose: MediaPurpose,
  verified = false,
) {
  if (!id) return;
  const asset = await tx.mediaAsset.findFirst({
    where: {
      id,
      quizId,
      ownerUserId: userId,
      purpose,
      status: {
        in: verified
          ? [MEDIA_STATUS.READY, MEDIA_STATUS.PENDING]
          : [MEDIA_STATUS.READY],
      },
    },
  });
  if (!asset)
    throw new ApiError(
      422,
      ERROR_CODE.VALIDATION_ERROR,
      'Choose an uploaded image belonging to this quiz.',
    );
  if (asset.status === MEDIA_STATUS.PENDING) {
    await tx.mediaAsset.update({
      where: { id },
      data: { status: MEDIA_STATUS.READY, readyAt: new Date() },
    });
    // A successful upload, for the daily upload allowance.
    await recordUsage(tx, userId, 'MEDIA_UPLOADED');
  }
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
  /**
   * Creates a quiz within the account's daily creation allowance (counted
   * under a lock on the account; deleting a quiz never gives it back). A
   * cover upload requested with it is reserved too; if its reservation is
   * refused (storage full), the quiz is still created and `coverRefusal`
   * says why.
   */
  create(
    projectId: string,
    userId: string,
    input: QuizInput,
    {
      id = randomUUID(),
      creationsPerDay,
      cover,
    }: {
      id?: string;
      creationsPerDay: number;
      cover?:
        | {
            data: Prisma.MediaAssetUncheckedCreateInput;
            reserve: (tx: Prisma.TransactionClient) => Promise<void>;
          }
        | undefined;
    },
  ) {
    return this.db.$transaction(async (tx) => {
      await lockAccount(tx, userId);
      await requireAllowance(
        tx,
        userId,
        'QUIZ_CREATED',
        creationsPerDay,
        (wait) =>
          `You can create up to ${creationsPerDay} quizzes a day. You can create another ${wait}.`,
      );
      if (
        !(await tx.project.findFirst({
          where: { id: projectId, ownerUserId: userId },
        }))
      )
        throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Project not found.');
      if (input.coverMediaId)
        throw new ApiError(
          422,
          ERROR_CODE.VALIDATION_ERROR,
          'Save the quiz before uploading its cover.',
        );
      const quiz = await tx.quiz.create({
        data: {
          ...input,
          id,
          projectId,
          creatorUserId: userId,
          publicId: randomBytes(12).toString('base64url'),
        },
        include: quizInclude,
      });
      await recordUsage(tx, userId, 'QUIZ_CREATED');
      let coverRefusal: string | null = null;
      if (cover)
        try {
          await cover.reserve(tx);
          await tx.mediaAsset.create({ data: cover.data });
        } catch (error) {
          if (!(error instanceof ApiError)) throw error;
          coverRefusal = error.message;
        }
      return { quiz, coverRefusal };
    }, lockedTransaction);
  }
  /** `coverVerified`: the cover is a PENDING upload whose file was checked. */
  update(id: string, userId: string, input: QuizInput, coverVerified = false) {
    return this.db.$transaction(async (tx) => {
      await lockEditableQuiz(tx, id, userId);
      // Same row lock as registration, so the count cannot change meanwhile.
      const registered = await tx.quizRegistration.count({
        where: { quizId: id, status: REGISTRATION_STATUS.REGISTERED },
      });
      if (input.registrationLimit < registered) {
        const message = `${registered} participants are already registered, so the limit cannot be lower than ${registered}.`;
        throw new ApiError(422, ERROR_CODE.VALIDATION_ERROR, message, {
          registrationLimit: message,
        });
      }
      await validateMedia(
        tx,
        input.coverMediaId,
        id,
        userId,
        MEDIA_PURPOSE.QUIZ_COVER,
        coverVerified,
      );
      return tx.quiz.update({
        where: { id },
        data: input,
        include: quizInclude,
      });
    }, lockedTransaction);
  }
  /**
   * Deletes a draft quiz with its questions and media rows. Only drafts can
   * be deleted: nobody has registered for or played them. Returns the
   * storage paths of its files, removed after the transaction commits.
   */
  remove(id: string, userId: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM quizzes WHERE id = ${id}::uuid FOR UPDATE`;
      const quiz = await tx.quiz.findFirst({
        where: { id, creatorUserId: userId, project: { ownerUserId: userId } },
        select: { status: true },
      });
      if (!quiz)
        throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Quiz not found.');
      if (quiz.status !== QUIZ_STATUS.DRAFT)
        throw new ApiError(
          409,
          ERROR_CODE.QUIZ_LOCKED,
          'Only draft quizzes can be deleted.',
        );
      const files = await tx.mediaAsset.findMany({
        where: { quizId: id, status: { not: MEDIA_STATUS.DELETED } },
        select: { objectPath: true },
      });
      await tx.quiz.delete({ where: { id } });
      return files.map((file) => file.objectPath);
    }, lockedTransaction);
  }
  publish(id: string, userId: string) {
    return this.db.$transaction(async (tx) => {
      const locked = await lockEditableQuiz(tx, id, userId);
      if (locked.status === QUIZ_STATUS.PUBLISHED)
        return tx.quiz.findUniqueOrThrow({
          where: { id },
          include: quizInclude,
        });
      if (locked.status !== QUIZ_STATUS.DRAFT)
        throw new ApiError(
          409,
          ERROR_CODE.QUIZ_LOCKED,
          'This quiz cannot be published.',
        );
      if (!locked.plannedStartAt)
        throw new ApiError(
          422,
          ERROR_CODE.VALIDATION_ERROR,
          'Choose a planned date and time before publishing.',
          {
            plannedStartAt: 'Choose a planned date and time before publishing.',
          },
        );
      return tx.quiz.update({
        where: { id },
        data: { status: QUIZ_STATUS.PUBLISHED, publishedAt: new Date() },
        include: quizInclude,
      });
    }, lockedTransaction);
  }
  publicById(publicId: string) {
    return this.db.quiz.findFirst({
      where: {
        publicId,
        status: { in: [...PUBLIC_QUIZ_STATUSES] },
      },
      include: publicQuizInclude,
    });
  }
}
