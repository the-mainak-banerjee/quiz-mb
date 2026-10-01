import { Prisma, type PrismaClient } from '@quizmb/database';
import { ApiError } from '../../http/api-error.js';
import { lockedTransaction } from '../../infrastructure/transactions.js';
import {
  ANSWER_STATUS,
  ASKED_QUESTION_STATUS,
  PUBLIC_QUIZ_STATUSES,
  ERROR_CODE,
  LIVE_SESSION_STATE,
  QUIZ_STATUS,
  REGISTRATION_STATUS,
} from '@quizmb/contracts';

export const liveSessionInclude = {
  quiz: {
    include: {
      project: { select: { name: true } },
      creator: { select: { name: true } },
      _count: {
        select: {
          questions: true,
          registrations: { where: { status: REGISTRATION_STATUS.REGISTERED } },
        },
      },
    },
  },
} satisfies Prisma.LiveQuizSessionInclude;

export type LiveSessionRow = Prisma.LiveQuizSessionGetPayload<{
  include: typeof liveSessionInclude;
}>;

const active = { state: { not: LIVE_SESSION_STATE.COMPLETED } } as const;

const askedInclude = {
  question: {
    include: { options: { orderBy: { position: 'asc' } }, image: true },
  },
} satisfies Prisma.AskedQuestionInclude;
export type AskedQuestionRow = Prisma.AskedQuestionGetPayload<{
  include: typeof askedInclude;
}>;

const submissionInclude = {
  options: { select: { questionOptionId: true } },
} satisfies Prisma.AnswerSubmissionInclude;
export type SubmissionRow = Prisma.AnswerSubmissionGetPayload<{
  include: typeof submissionInclude;
}>;

/** Newest descriptive responses included in host progress. */
const HOST_RESPONSE_LIMIT = 50;

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === 'P2002';

const alreadyAsked = () =>
  new ApiError(
    409,
    ERROR_CODE.QUESTION_ALREADY_ASKED,
    'This question has already been asked in this session.',
  );

const submissionClosed = () =>
  new ApiError(
    409,
    ERROR_CODE.SUBMISSION_CLOSED,
    'Time is up. Answers for this question are closed.',
  );

function activeSessionConflict(liveSessionId: string, quizId: string) {
  return new ApiError(
    409,
    ERROR_CODE.ACTIVE_SESSION_EXISTS,
    'You already have an active live quiz in progress.',
    { liveSessionId, quizId },
  );
}

function invalidTransition(): never {
  throw new ApiError(
    409,
    ERROR_CODE.INVALID_STATE_TRANSITION,
    'This action is not available in the current live state.',
  );
}

async function lockSession(tx: Prisma.TransactionClient, id: string) {
  await tx.$queryRaw`SELECT id FROM live_quiz_sessions WHERE id = ${id}::uuid FOR UPDATE`;
  const session = await tx.liveQuizSession.findUnique({ where: { id } });
  if (!session)
    throw new ApiError(
      404,
      ERROR_CODE.SESSION_NOT_FOUND,
      'Live session not found.',
    );
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
        if (!quiz)
          throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Quiz not found.');
        const existing = await tx.liveQuizSession.findFirst({
          where: { quizId, ...active },
        });
        if (existing) return existing.id;
        if (quiz.status === QUIZ_STATUS.COMPLETED)
          throw new ApiError(
            409,
            ERROR_CODE.QUIZ_COMPLETED,
            'This quiz has already been completed.',
          );
        if (quiz.status !== QUIZ_STATUS.PUBLISHED)
          throw new ApiError(
            409,
            ERROR_CODE.QUIZ_NOT_OPEN,
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
          data: { status: QUIZ_STATUS.LOBBY },
        });
        return session.id;
      }, lockedTransaction);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const other = await this.db.liveQuizSession.findFirst({
          where: { hostUserId, ...active },
        });
        if (other?.quizId === quizId) return other.id;
        if (other) throw activeSessionConflict(other.id, other.quizId);
      }
      throw error;
    }
  }

  /** Lifecycle status of a quiz that is visible publicly (not a draft). */
  publicStatus(quizId: string) {
    return this.db.quiz.findFirst({
      where: {
        id: quizId,
        status: { in: [...PUBLIC_QUIZ_STATUSES] },
      },
      select: { id: true, status: true },
    });
  }

  registration(quizId: string, userId: string) {
    return this.db.quizRegistration.findFirst({
      where: { quizId, userId, status: REGISTRATION_STATUS.REGISTERED },
      select: { id: true },
    });
  }

  participation(liveSessionId: string, userId: string) {
    return this.db.participantSession.findUnique({
      where: { liveSessionId_userId: { liveSessionId, userId } },
      select: { id: true, firstJoinedAt: true },
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
      if (session.state !== LIVE_SESSION_STATE.LOBBY) invalidTransition();
      const startedAt = new Date();
      await tx.liveQuizSession.update({
        where: { id },
        data: { state: LIVE_SESSION_STATE.LIVE_IDLE, startedAt },
      });
      await tx.quiz.update({
        where: { id: session.quizId },
        data: { status: QUIZ_STATUS.LIVE },
      });
    }, lockedTransaction);
  }

  setLateJoin(id: string, allowLateJoin: boolean) {
    return this.db.$transaction(async (tx) => {
      const session = await lockSession(tx, id);
      if (session.state === LIVE_SESSION_STATE.COMPLETED) invalidTransition();
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
      if (session.state !== LIVE_SESSION_STATE.LOBBY) invalidTransition();
      await tx.liveQuizSession.delete({ where: { id } });
      await tx.quiz.update({
        where: { id: session.quizId },
        data: { status: QUIZ_STATUS.PUBLISHED },
      });
      return session.quizId;
    }, lockedTransaction);
  }

  /**
   * Marks the session and quiz completed. An active question closes at the
   * current server time; answers accepted before then are kept. Idempotent.
   */
  end(id: string) {
    return this.db.$transaction(async (tx) => {
      const session = await lockSession(tx, id);
      if (session.state === LIVE_SESSION_STATE.COMPLETED) return false;
      const endedAt = new Date();
      await tx.askedQuestion.updateMany({
        where: { liveSessionId: id, status: ASKED_QUESTION_STATUS.ACTIVE },
        data: { status: ASKED_QUESTION_STATUS.COMPLETED, completedAt: endedAt },
      });
      await tx.liveQuizSession.update({
        where: { id },
        data: { state: LIVE_SESSION_STATE.COMPLETED, endedAt },
      });
      await tx.quiz.update({
        where: { id: session.quizId },
        data: { status: QUIZ_STATUS.COMPLETED },
      });
      return true;
    }, lockedTransaction);
  }

  roster(quizId: string, limit: number) {
    return this.db.quizRegistration.findMany({
      where: { quizId, status: REGISTRATION_STATUS.REGISTERED },
      orderBy: { registeredAt: 'asc' },
      take: limit,
      include: { user: { select: { id: true, name: true } } },
    });
  }

  // ---- Asked questions and answers -----------------------------------------

  askedQuestions(liveSessionId: string) {
    return this.db.askedQuestion.findMany({
      where: { liveSessionId },
      orderBy: { sequenceNumber: 'asc' },
      select: { id: true, questionId: true, sequenceNumber: true },
    });
  }

  /** The most recently asked question (active or just ended). */
  latestAsked(liveSessionId: string) {
    return this.db.askedQuestion.findFirst({
      where: { liveSessionId },
      orderBy: { sequenceNumber: 'desc' },
      include: askedInclude,
    });
  }

  findAsked(id: string) {
    return this.db.askedQuestion.findUnique({
      where: { id },
      include: {
        ...askedInclude,
        liveSession: { select: { quizId: true, hostUserId: true } },
      },
    });
  }

  activeAsked(liveSessionId: string) {
    return this.db.askedQuestion.findFirst({
      where: { liveSessionId, status: ASKED_QUESTION_STATUS.ACTIVE },
      select: { id: true, endsAt: true },
    });
  }

  /** Every active question across sessions, for timer recovery at boot. */
  allActiveAsked() {
    return this.db.askedQuestion.findMany({
      where: { status: ASKED_QUESTION_STATUS.ACTIVE },
      select: { id: true, liveSessionId: true, endsAt: true },
    });
  }

  /**
   * LIVE_IDLE or QUESTION_RESULT to QUESTION_ACTIVE. Any unused question of
   * the quiz may be asked, in any order; its timer starts now.
   */
  async startQuestion(id: string, questionId: string) {
    try {
      return await this.db.$transaction(async (tx) => {
        const session = await lockSession(tx, id);
        if (
          session.state !== LIVE_SESSION_STATE.LIVE_IDLE &&
          session.state !== LIVE_SESSION_STATE.QUESTION_RESULT
        )
          invalidTransition();
        const question = await tx.question.findFirst({
          where: { id: questionId, quizId: session.quizId },
          select: {
            type: true,
            durationOverrideSeconds: true,
            options: { select: { id: true, isCorrect: true } },
            quiz: { select: { defaultQuestionDurationSeconds: true } },
          },
        });
        if (!question)
          throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Question not found.');
        const used = await tx.askedQuestion.findUnique({
          where: {
            liveSessionId_questionId: { liveSessionId: id, questionId },
          },
          select: { id: true },
        });
        if (used) throw alreadyAsked();
        const durationSeconds =
          question.durationOverrideSeconds ??
          question.quiz.defaultQuestionDurationSeconds;
        const startedAt = new Date();
        const sequenceNumber =
          (await tx.askedQuestion.count({ where: { liveSessionId: id } })) + 1;
        const asked = await tx.askedQuestion.create({
          data: {
            liveSessionId: id,
            questionId,
            sequenceNumber,
            durationSeconds,
            startedAt,
            endsAt: new Date(startedAt.getTime() + durationSeconds * 1000),
          },
        });
        await tx.liveQuizSession.update({
          where: { id },
          data: { state: LIVE_SESSION_STATE.QUESTION_ACTIVE },
        });
        return {
          asked,
          quizId: session.quizId,
          hostUserId: session.hostUserId,
          type: question.type,
          options: question.options,
        };
      }, lockedTransaction);
    } catch (error) {
      if (isUniqueViolation(error)) throw alreadyAsked();
      throw error;
    }
  }

  /**
   * ACTIVE to COMPLETED exactly once; the session moves to QUESTION_RESULT.
   * Returns false when another caller already closed it.
   */
  finalizeQuestion(liveSessionId: string, askedQuestionId: string) {
    return this.db.$transaction(async (tx) => {
      const session = await lockSession(tx, liveSessionId);
      const asked = await tx.askedQuestion.findUnique({
        where: { id: askedQuestionId },
      });
      if (
        !asked ||
        asked.liveSessionId !== liveSessionId ||
        asked.status !== ASKED_QUESTION_STATUS.ACTIVE
      )
        return false;
      await tx.askedQuestion.update({
        where: { id: askedQuestionId },
        data: {
          status: ASKED_QUESTION_STATUS.COMPLETED,
          completedAt: asked.endsAt,
        },
      });
      if (session.state === LIVE_SESSION_STATE.QUESTION_ACTIVE)
        await tx.liveQuizSession.update({
          where: { id: liveSessionId },
          data: { state: LIVE_SESSION_STATE.QUESTION_RESULT },
        });
      return true;
    }, lockedTransaction);
  }

  /**
   * Persists one accepted answer in a single atomic statement (one round
   * trip on the hot path). The shared row lock on the asked question
   * serializes against closing it, so nothing is accepted once it has
   * ended; the unique key rejects a second answer from the same user.
   */
  async submit(input: {
    askedQuestionId: string;
    userId: string;
    selectedOptionIds: string[];
    answerText: string | null;
    isCorrect: boolean | null;
    pointsAwarded: number;
    submittedAt: Date;
    responseTimeMs: number;
  }) {
    const [row] = await this.db.$queryRaw<
      Array<{ open: number; inserted: string | null }>
    >`
      WITH question AS (
        SELECT id FROM asked_questions
        WHERE id = ${input.askedQuestionId}::uuid
          AND status = ${ASKED_QUESTION_STATUS.ACTIVE}::"AskedQuestionStatus"
          AND "endsAt" > ${input.submittedAt}
        FOR SHARE
      ),
      submission AS (
        INSERT INTO answer_submissions
          (id, "askedQuestionId", "userId", status, "answerText",
           "submittedAt", "responseTimeMs", "isCorrect", "pointsAwarded")
        SELECT gen_random_uuid(), question.id, ${input.userId}::uuid,
          ${ANSWER_STATUS.SUBMITTED}::"AnswerStatus", ${input.answerText}::text,
          ${input.submittedAt}, ${input.responseTimeMs}::int,
          ${input.isCorrect}::boolean, ${input.pointsAwarded}::int
        FROM question
        ON CONFLICT ("askedQuestionId", "userId") DO NOTHING
        RETURNING id
      ),
      selections AS (
        INSERT INTO answer_submission_options
          ("answerSubmissionId", "questionOptionId")
        SELECT submission.id, option_id
        FROM submission, unnest(${input.selectedOptionIds}::uuid[]) AS option_id
      )
      SELECT (SELECT count(*) FROM question)::int AS open,
        (SELECT id::text FROM submission) AS inserted`;
    if (!row?.open) throw submissionClosed();
    if (!row.inserted)
      throw new ApiError(
        409,
        ERROR_CODE.ALREADY_SUBMITTED,
        'You have already submitted an answer for this question.',
      );
  }

  /**
   * Score and rank of everyone who entered the session, over completed
   * questions only (an active question never changes standings). Ties share
   * a rank (1, 1, 3); missed questions simply add nothing. Pass `userId` to
   * read one participant's row from the same ranking.
   */
  async standings(liveSessionId: string, userId?: string) {
    const rows = await this.db.$queryRaw<
      Array<{
        userId: string;
        totalScore: number;
        rank: number;
        participantCount: number;
      }>
    >`
      SELECT * FROM (
        SELECT ps."userId"::text AS "userId",
          COALESCE(SUM(s."pointsAwarded"), 0)::int AS "totalScore",
          RANK() OVER (
            ORDER BY COALESCE(SUM(s."pointsAwarded"), 0) DESC
          )::int AS rank,
          COUNT(*) OVER ()::int AS "participantCount"
        FROM participant_sessions ps
        LEFT JOIN asked_questions aq
          ON aq."liveSessionId" = ps."liveSessionId"
          AND aq.status = ${ASKED_QUESTION_STATUS.COMPLETED}::"AskedQuestionStatus"
        LEFT JOIN answer_submissions s
          ON s."askedQuestionId" = aq.id AND s."userId" = ps."userId"
        WHERE ps."liveSessionId" = ${liveSessionId}::uuid
        GROUP BY ps."userId"
      ) ranked
      WHERE ${userId ?? null}::uuid IS NULL OR ranked."userId" = ${userId ?? null}::text`;
    return rows;
  }

  submissionFor(askedQuestionId: string, userId: string) {
    return this.db.answerSubmission.findUnique({
      where: { askedQuestionId_userId: { askedQuestionId, userId } },
      include: submissionInclude,
    });
  }

  submissions(askedQuestionId: string) {
    return this.db.answerSubmission.findMany({
      where: { askedQuestionId },
      include: submissionInclude,
    });
  }

  /** Submission count, per-option counts and newest descriptive responses. */
  async progress(askedQuestionId: string, withResponses: boolean) {
    const [submittedCount, groups, responses] = await Promise.all([
      this.db.answerSubmission.count({ where: { askedQuestionId } }),
      this.db.answerSubmissionOption.groupBy({
        by: ['questionOptionId'],
        where: { submission: { askedQuestionId } },
        _count: { _all: true },
      }),
      withResponses
        ? this.db.answerSubmission.findMany({
            where: { askedQuestionId, answerText: { not: null } },
            orderBy: { submittedAt: 'desc' },
            take: HOST_RESPONSE_LIMIT,
            select: { id: true, answerText: true, submittedAt: true },
          })
        : Promise.resolve([]),
    ]);
    return {
      submittedCount,
      distribution: Object.fromEntries(
        groups.map((group) => [group.questionOptionId, group._count._all]),
      ),
      responses,
    };
  }

  hostQuestions(quizId: string) {
    return this.db.question.findMany({
      where: { quizId },
      orderBy: { position: 'asc' },
      include: { options: { orderBy: { position: 'asc' } } },
    });
  }
}
