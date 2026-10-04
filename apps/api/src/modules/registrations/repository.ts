import { Prisma, type PrismaClient } from '@quizmb/database';
import { ApiError } from '../../http/api-error.js';
import { publicQuizInclude } from '../quizzes/repository.js';
import { lockedTransaction } from '../../infrastructure/transactions.js';
import {
  ERROR_CODE,
  LIVE_SESSION_STATE,
  QUIZ_STATUS,
  REGISTRATION_STATUS,
} from '@quizmb/contracts';

/** The API error for a `register_participant` outcome. */
function registrationRefusal(outcome: string | undefined) {
  switch (outcome) {
    case ERROR_CODE.HOST_CANNOT_REGISTER:
      return new ApiError(
        403,
        ERROR_CODE.HOST_CANNOT_REGISTER,
        'Quiz hosts cannot register as participants in their own quiz.',
      );
    case ERROR_CODE.QUIZ_COMPLETED:
    case ERROR_CODE.REGISTRATION_CLOSED:
      return new ApiError(
        409,
        outcome,
        'Registration is not open for this quiz.',
      );
    case ERROR_CODE.ALREADY_REGISTERED:
      return new ApiError(
        409,
        ERROR_CODE.ALREADY_REGISTERED,
        'You are already registered for this quiz.',
      );
    case ERROR_CODE.QUIZ_FULL:
      return new ApiError(
        409,
        ERROR_CODE.QUIZ_FULL,
        'This quiz is fully registered.',
      );
    default:
      return new ApiError(404, ERROR_CODE.NOT_FOUND, 'Quiz not found.');
  }
}

export class RegistrationsRepository {
  constructor(readonly db: PrismaClient) {}

  /**
   * One database call (`register_participant`, see its migration): the quiz
   * row lock is held for milliseconds, so bursts stay fast and capacity
   * exact. Outcomes other than REGISTERED are API error codes.
   */
  async register(quizId: string, userId: string) {
    const [row] = await this.db.$queryRaw<
      {
        outcome: string;
        registrationId: string | null;
        registeredAt: Date | null;
        registrationCount: number;
      }[]
    >`SELECT * FROM register_participant(${quizId}::uuid, ${userId}::uuid)`;
    if (row?.outcome === REGISTRATION_STATUS.REGISTERED)
      return {
        registration: {
          id: row.registrationId!,
          registeredAt: row.registeredAt!,
        },
        registrationCount: row.registrationCount,
      };
    throw registrationRefusal(row?.outcome);
  }

  unregister(quizId: string, userId: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM quizzes WHERE id = ${quizId}::uuid FOR UPDATE`;
      const quiz = await tx.quiz.findUnique({
        where: { id: quizId },
        select: { status: true },
      });
      if (!quiz)
        throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Quiz not found.');
      if (
        quiz.status === QUIZ_STATUS.LIVE ||
        quiz.status === QUIZ_STATUS.COMPLETED
      )
        throw new ApiError(
          409,
          ERROR_CODE.UNREGISTRATION_CLOSED,
          'Registration can no longer be cancelled.',
        );
      const registration = await tx.quizRegistration.findUnique({
        where: { quizId_userId: { quizId, userId } },
      });
      if (
        !registration ||
        registration.status !== REGISTRATION_STATUS.REGISTERED
      )
        throw new ApiError(
          404,
          ERROR_CODE.NOT_REGISTERED,
          'Registration not found.',
        );
      await tx.quizRegistration.update({
        where: { id: registration.id },
        data: {
          status: REGISTRATION_STATUS.CANCELLED,
          cancelledAt: new Date(),
        },
      });
      const registrationCount = await tx.quizRegistration.count({
        where: { quizId, status: REGISTRATION_STATUS.REGISTERED },
      });
      return { registrationCount };
    }, lockedTransaction);
  }

  async own(quizId: string, userId: string) {
    const [quiz, registration, registrationCount] = await Promise.all([
      this.db.quiz.findUnique({
        where: { id: quizId },
        select: {
          id: true,
          liveSessions: {
            where: { state: LIVE_SESSION_STATE.COMPLETED },
            orderBy: { endedAt: 'desc' },
            take: 1,
            select: { id: true },
          },
        },
      }),
      this.db.quizRegistration.findUnique({
        where: { quizId_userId: { quizId, userId } },
      }),
      this.db.quizRegistration.count({
        where: { quizId, status: REGISTRATION_STATUS.REGISTERED },
      }),
    ]);
    if (!quiz) throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Quiz not found.');
    return {
      registration,
      registrationCount,
      completedLiveSessionId: quiz.liveSessions[0]?.id ?? null,
    };
  }

  async hostList(
    quizId: string,
    userId: string,
    cursor: string | undefined,
    limit: number,
  ) {
    const quiz = await this.db.quiz.findFirst({
      where: { id: quizId, creatorUserId: userId },
      select: { id: true },
    });
    if (!quiz) throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Quiz not found.');
    return this.db.quizRegistration.findMany({
      where: {
        quizId,
        status: REGISTRATION_STATUS.REGISTERED,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: limit + 1,
      include: { user: { select: { id: true, name: true } } },
    });
  }

  async hostListAll(quizId: string, userId: string) {
    const quiz = await this.db.quiz.findFirst({
      where: { id: quizId, creatorUserId: userId },
      select: { id: true },
    });
    if (!quiz) throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Quiz not found.');
    return this.db.quizRegistration.findMany({
      where: { quizId, status: REGISTRATION_STATUS.REGISTERED },
      orderBy: { registeredAt: 'asc' },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  upcoming(
    userId: string,
    statuses: Array<
      | typeof QUIZ_STATUS.PUBLISHED
      | typeof QUIZ_STATUS.LOBBY
      | typeof QUIZ_STATUS.LIVE
    >,
  ) {
    return this.db.quizRegistration.findMany({
      where: {
        userId,
        status: REGISTRATION_STATUS.REGISTERED,
        quiz: { status: { in: statuses } },
      },
      orderBy: { quiz: { plannedStartAt: 'asc' } },
      include: { quiz: { include: publicQuizInclude } },
    });
  }

  async hostDashboard(userId: string) {
    const [projects, quizzes] = await Promise.all([
      this.db.project.findMany({
        where: { ownerUserId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 25,
        include: {
          _count: { select: { quizzes: true, associations: true } },
        },
      }),
      this.db.quiz.findMany({
        where: { creatorUserId: userId },
        orderBy: { updatedAt: 'desc' },
        take: 50,
        include: {
          project: { select: { name: true } },
          _count: {
            select: {
              questions: true,
              registrations: {
                where: { status: REGISTRATION_STATUS.REGISTERED },
              },
            },
          },
        },
      }),
    ]);
    return { projects, quizzes };
  }
}

export type UpcomingRegistrationRow = Prisma.QuizRegistrationGetPayload<{
  include: { quiz: { include: typeof publicQuizInclude } };
}>;
