import { Prisma, type PrismaClient } from '@quizmb/database';
import { ApiError } from '../../http/api-error.js';
import { publicQuizInclude } from '../quizzes/repository.js';

// Registration writes queue on the quiz row lock, so a burst for one quiz
// waits longer than Prisma's 2s/5s defaults with the small connection pool.
// Waiting keeps capacity checks serialized instead of failing with P2028.
const capacityTransaction = { maxWait: 15_000, timeout: 15_000 };

export class RegistrationsRepository {
  constructor(readonly db: PrismaClient) {}

  register(quizId: string, userId: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM quizzes WHERE id = ${quizId}::uuid FOR UPDATE`;
      const quiz = await tx.quiz.findUnique({
        where: { id: quizId },
        select: {
          id: true,
          projectId: true,
          creatorUserId: true,
          registrationLimit: true,
          status: true,
        },
      });
      if (!quiz) throw new ApiError(404, 'NOT_FOUND', 'Quiz not found.');
      if (quiz.creatorUserId === userId)
        throw new ApiError(
          403,
          'HOST_CANNOT_REGISTER',
          'Quiz hosts cannot register as participants in their own quiz.',
        );
      if (quiz.status !== 'PUBLISHED')
        throw new ApiError(
          409,
          quiz.status === 'COMPLETED'
            ? 'QUIZ_COMPLETED'
            : 'REGISTRATION_CLOSED',
          'Registration is not open for this quiz.',
        );
      const existing = await tx.quizRegistration.findUnique({
        where: { quizId_userId: { quizId, userId } },
      });
      if (existing?.status === 'REGISTERED')
        throw new ApiError(
          409,
          'ALREADY_REGISTERED',
          'You are already registered for this quiz.',
        );
      const registrationCount = await tx.quizRegistration.count({
        where: { quizId, status: 'REGISTERED' },
      });
      if (registrationCount >= quiz.registrationLimit)
        throw new ApiError(409, 'QUIZ_FULL', 'This quiz is fully registered.');
      const now = new Date();
      const registration = existing
        ? await tx.quizRegistration.update({
            where: { id: existing.id },
            data: {
              status: 'REGISTERED',
              registeredAt: now,
              cancelledAt: null,
            },
          })
        : await tx.quizRegistration.create({
            data: { quizId, userId, registeredAt: now },
          });
      await tx.projectAssociation.upsert({
        where: {
          projectId_userId: { projectId: quiz.projectId, userId },
        },
        create: {
          projectId: quiz.projectId,
          userId,
          createdViaQuizId: quizId,
        },
        update: {},
      });
      return { registration, registrationCount: registrationCount + 1 };
    }, capacityTransaction);
  }

  unregister(quizId: string, userId: string) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM quizzes WHERE id = ${quizId}::uuid FOR UPDATE`;
      const quiz = await tx.quiz.findUnique({
        where: { id: quizId },
        select: { status: true },
      });
      if (!quiz) throw new ApiError(404, 'NOT_FOUND', 'Quiz not found.');
      if (quiz.status === 'LIVE' || quiz.status === 'COMPLETED')
        throw new ApiError(
          409,
          'UNREGISTRATION_CLOSED',
          'Registration can no longer be cancelled.',
        );
      const registration = await tx.quizRegistration.findUnique({
        where: { quizId_userId: { quizId, userId } },
      });
      if (!registration || registration.status !== 'REGISTERED')
        throw new ApiError(404, 'NOT_REGISTERED', 'Registration not found.');
      await tx.quizRegistration.update({
        where: { id: registration.id },
        data: { status: 'CANCELLED', cancelledAt: new Date() },
      });
      const registrationCount = await tx.quizRegistration.count({
        where: { quizId, status: 'REGISTERED' },
      });
      return { registrationCount };
    }, capacityTransaction);
  }

  async own(quizId: string, userId: string) {
    const [quiz, registration, registrationCount] = await Promise.all([
      this.db.quiz.findUnique({ where: { id: quizId }, select: { id: true } }),
      this.db.quizRegistration.findUnique({
        where: { quizId_userId: { quizId, userId } },
      }),
      this.db.quizRegistration.count({
        where: { quizId, status: 'REGISTERED' },
      }),
    ]);
    if (!quiz) throw new ApiError(404, 'NOT_FOUND', 'Quiz not found.');
    return { registration, registrationCount };
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
    if (!quiz) throw new ApiError(404, 'NOT_FOUND', 'Quiz not found.');
    return this.db.quizRegistration.findMany({
      where: {
        quizId,
        status: 'REGISTERED',
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
    if (!quiz) throw new ApiError(404, 'NOT_FOUND', 'Quiz not found.');
    return this.db.quizRegistration.findMany({
      where: { quizId, status: 'REGISTERED' },
      orderBy: { registeredAt: 'asc' },
      include: { user: { select: { id: true, name: true } } },
    });
  }

  upcoming(userId: string) {
    return this.db.quizRegistration.findMany({
      where: {
        userId,
        status: 'REGISTERED',
        quiz: { status: 'PUBLISHED' },
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
              registrations: { where: { status: 'REGISTERED' } },
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
