import { Prisma, type PrismaClient } from '@quizmb/database';
import { ApiError } from '../../http/api-error.js';
import { lockedTransaction } from '../../infrastructure/transactions.js';

export const liveSessionInclude = {
  quiz: {
    include: {
      project: { select: { name: true } },
      creator: { select: { name: true } },
      _count: {
        select: {
          questions: true,
          registrations: { where: { status: 'REGISTERED' } },
        },
      },
    },
  },
} satisfies Prisma.LiveQuizSessionInclude;

export type LiveSessionRow = Prisma.LiveQuizSessionGetPayload<{
  include: typeof liveSessionInclude;
}>;

const active = { state: { not: 'COMPLETED' } } as const;

function activeSessionConflict(liveSessionId: string, quizId: string) {
  return new ApiError(
    409,
    'ACTIVE_SESSION_EXISTS',
    'You already have an active live quiz in progress.',
    { liveSessionId, quizId },
  );
}

function invalidTransition(): never {
  throw new ApiError(
    409,
    'INVALID_STATE_TRANSITION',
    'This action is not available in the current live state.',
  );
}

async function lockSession(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM live_quiz_sessions WHERE id = ${id}::uuid FOR UPDATE`;
  const session = await tx.liveQuizSession.findUnique({ where: { id } });
  if (!session)
    throw new ApiError(404, 'SESSION_NOT_FOUND', 'Live session not found.');
  return session;
}

export class LiveSessionsRepository {
  constructor(readonly db: PrismaClient) {}

  findById(id: string) {
    return this.db.liveQuizSession.findUnique({
      where: { id },
      include: liveSessionInclude,
    });
  }

  findActiveForQuiz(quizId: string) {
    return this.db.liveQuizSession.findFirst({
      where: { quizId, ...active },
      include: liveSessionInclude,
    });
  }

  findActiveForHost(hostUserId: string) {
    return this.db.liveQuizSession.findFirst({
      where: { hostUserId, ...active },
      include: liveSessionInclude,
    });
  }

  /**
   * Opens the lobby for a published quiz owned by the host. Idempotent for the
   * same quiz; rejects while the host runs any other unfinished session. The
   * partial unique indexes make concurrent opens safe even across quizzes.
   */
  async openLobby(quizId: string, hostUserId: string) {
    try {
      return await this.db.$transaction(async (tx) => {
        // Serialize lobby opens per host (then per quiz, always in this
        // order) so concurrent opens see each other's committed session and
        // return 409 or the idempotent session instead of racing the index.
        await tx.$queryRaw`SELECT id FROM users WHERE id = ${hostUserId}::uuid FOR UPDATE`;
        await tx.$queryRaw`SELECT id FROM quizzes WHERE id = ${quizId}::uuid FOR UPDATE`;
        const quiz = await tx.quiz.findFirst({
          where: {
            id: quizId,
            creatorUserId: hostUserId,
            project: { ownerUserId: hostUserId },
          },
        });
        if (!quiz) throw new ApiError(404, 'NOT_FOUND', 'Quiz not found.');
        const existing = await tx.liveQuizSession.findFirst({
          where: { quizId, ...active },
        });
        if (existing) return existing.id;
        if (quiz.status === 'COMPLETED')
          throw new ApiError(
            409,
            'QUIZ_COMPLETED',
            'This quiz has already been completed.',
          );
        if (quiz.status !== 'PUBLISHED')
          throw new ApiError(
            409,
            'QUIZ_NOT_OPEN',
            'Publish this quiz before opening its live lobby.',
          );
        const other = await tx.liveQuizSession.findFirst({
          where: { hostUserId, ...active },
        });
        if (other) throw activeSessionConflict(other.id, other.quizId);
        const session = await tx.liveQuizSession.create({
          data: { quizId, hostUserId, allowLateJoin: quiz.allowLateJoin },
        });
        await tx.quiz.update({
          where: { id: quizId },
          data: { status: 'LOBBY' },
        });
        return session.id;
      }, lockedTransaction);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const other = await this.db.liveQuizSession.findFirst({
          where: { hostUserId, ...active },
        });
        if (other?.quizId === quizId) return other.id;
        if (other) throw activeSessionConflict(other.id, other.quizId);
      }
      throw error;
    }
  }

  registration(quizId: string, userId: string) {
    return this.db.quizRegistration.findFirst({
      where: { quizId, userId, status: 'REGISTERED' },
      select: { id: true },
    });
  }

  participation(liveSessionId: string, userId: string) {
    return this.db.participantSession.findUnique({
      where: { liveSessionId_userId: { liveSessionId, userId } },
      select: { id: true },
    });
  }

  recordJoin(liveSessionId: string, userId: string) {
    const now = new Date();
    return this.db.participantSession.upsert({
      where: { liveSessionId_userId: { liveSessionId, userId } },
      create: { liveSessionId, userId, firstJoinedAt: now, lastJoinedAt: now },
      update: { lastJoinedAt: now, leftAt: null },
    });
  }

  /** Unregistered users are no longer attendees of this session. */
  removeParticipation(liveSessionId: string, userId: string) {
    return this.db.participantSession.deleteMany({
      where: { liveSessionId, userId },
    });
  }

  /** LOBBY → LIVE_IDLE. Closes registration and locks quiz content. */
  start(id: string) {
    return this.db.$transaction(async (tx) => {
      const session = await lockSession(tx, id);
      if (session.state !== 'LOBBY') invalidTransition();
      const startedAt = new Date();
      await tx.liveQuizSession.update({
        where: { id },
        data: { state: 'LIVE_IDLE', startedAt },
      });
      await tx.quiz.update({
        where: { id: session.quizId },
        data: { status: 'LIVE' },
      });
    }, lockedTransaction);
  }

  setLateJoin(id: string, allowLateJoin: boolean) {
    return this.db.$transaction(async (tx) => {
      const session = await lockSession(tx, id);
      if (session.state === 'COMPLETED') invalidTransition();
      await tx.liveQuizSession.update({
        where: { id },
        data: { allowLateJoin },
      });
    }, lockedTransaction);
  }

  /**
   * Cancels an unstarted lobby: nothing competitive exists yet, so the
   * session (and its lobby attendance) is deleted and the quiz returns to
   * PUBLISHED with registrations intact.
   */
  closeLobby(id: string) {
    return this.db.$transaction(async (tx) => {
      const session = await lockSession(tx, id);
      if (session.state !== 'LOBBY') invalidTransition();
      await tx.liveQuizSession.delete({ where: { id } });
      await tx.quiz.update({
        where: { id: session.quizId },
        data: { status: 'PUBLISHED' },
      });
      return session.quizId;
    }, lockedTransaction);
  }

  /** Minimal Phase 5 end: marks the session and quiz completed. Idempotent. */
  end(id: string) {
    return this.db.$transaction(async (tx) => {
      const session = await lockSession(tx, id);
      if (session.state === 'COMPLETED') return false;
      await tx.liveQuizSession.update({
        where: { id },
        data: { state: 'COMPLETED', endedAt: new Date() },
      });
      await tx.quiz.update({
        where: { id: session.quizId },
        data: { status: 'COMPLETED' },
      });
      return true;
    }, lockedTransaction);
  }

  roster(quizId: string, limit: number) {
    return this.db.quizRegistration.findMany({
      where: { quizId, status: 'REGISTERED' },
      orderBy: { registeredAt: 'asc' },
      take: limit,
      include: { user: { select: { id: true, name: true } } },
    });
  }

  hostQuestions(quizId: string) {
    return this.db.question.findMany({
      where: { quizId },
      orderBy: { position: 'asc' },
      include: { options: { orderBy: { position: 'asc' } } },
    });
  }
}
