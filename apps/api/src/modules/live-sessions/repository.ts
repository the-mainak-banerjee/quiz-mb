import { Prisma, type PrismaClient } from '@quizmb/database';
import { ApiError } from '../../http/api-error.js';
import { lockedTransaction } from '../../infrastructure/transactions.js';
import {
  ANSWER_STATUS,
  ASKED_QUESTION_STATUS,
  PUBLIC_QUIZ_STATUSES,
  ERROR_CODE,
  LIVE_SESSION_STATE,
  QUESTION_TYPE,
  type LiveSessionState,
  QUIZ_STATUS,
  REGISTRATION_STATUS,
} from '@quizmb/contracts';

/**
 * What the live module needs about a session and its quiz. Built only by
 * `selectSessions`, the single query every session lookup goes through.
 */
export type LiveSessionRow = {
  id: string;
  quizId: string;
  hostUserId: string;
  state: LiveSessionState;
  allowLateJoin: boolean;
  startedAt: Date | null;
  endedAt: Date | null;
  createdAt: Date;
  /** Set once the host reveals the final leaderboard. */
  finalLeaderboardShownAt: Date | null;
  quiz: {
    id: string;
    publicId: string;
    title: string;
    plannedStartAt: Date | null;
    registrationLimit: number;
    defaultQuestionDurationSeconds: number;
    project: { name: string };
    creator: { name: string };
    _count: { questions: number; registrations: number };
  };
};

const active = { state: { not: LIVE_SESSION_STATE.COMPLETED } } as const;
/** The same filter as `active`, for raw session queries (alias `s`). */
const unfinished = Prisma.sql`s.state <> ${LIVE_SESSION_STATE.COMPLETED}::"LiveSessionState"`;

/**
 * Score and rank of everyone who entered the session, over completed
 * questions only (an active question never changes standings). Ties share a
 * rank (1, 1, 3); missed questions simply add nothing. The one ranking both
 * personal standings and the leaderboard read, so they always agree.
 */
function rankedStandings(liveSessionId: string) {
  return Prisma.sql`
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
    GROUP BY ps."userId"`;
}

/**
 * Final results for everyone who entered the session: total points over all
 * asked questions (the shared RANK() semantics), and correct / incorrect /
 * not-attempted counts over asked scored questions only. Descriptive
 * questions never score and are not counted. Unasked questions have no
 * AskedQuestion row, so they cannot affect anything.
 */
function finalResultRows(liveSessionId: string) {
  return Prisma.sql`
    SELECT ps."userId",
      COALESCE(SUM(s."pointsAwarded"), 0)::int AS "totalScore",
      RANK() OVER (
        ORDER BY COALESCE(SUM(s."pointsAwarded"), 0) DESC
      )::int AS rank,
      COUNT(s.id) FILTER (
        WHERE s."isCorrect" AND q.type <> ${QUESTION_TYPE.DESCRIPTIVE}::"QuestionType"
      )::int AS "correctCount",
      COUNT(s.id) FILTER (
        WHERE NOT s."isCorrect" AND q.type <> ${QUESTION_TYPE.DESCRIPTIVE}::"QuestionType"
      )::int AS "incorrectCount",
      (COUNT(aq.id) FILTER (
        WHERE q.type <> ${QUESTION_TYPE.DESCRIPTIVE}::"QuestionType"
      ) - COUNT(s.id) FILTER (
        WHERE q.type <> ${QUESTION_TYPE.DESCRIPTIVE}::"QuestionType"
      ))::int AS "notAttemptedCount"
    FROM participant_sessions ps
    LEFT JOIN asked_questions aq ON aq."liveSessionId" = ps."liveSessionId"
    LEFT JOIN questions q ON q.id = aq."questionId"
    LEFT JOIN answer_submissions s
      ON s."askedQuestionId" = aq.id AND s."userId" = ps."userId"
    WHERE ps."liveSessionId" = ${liveSessionId}::uuid
    GROUP BY ps."userId"`;
}

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

/** Unique-key violation from a Prisma call (P2002) or raw SQL (P2010). */
const isUniqueViolation = (error: unknown) => {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (error.code === 'P2002') return true;
  const cause = (
    error.meta as
      { driverAdapterError?: { cause?: { originalCode?: string } } } | undefined
  )?.driverAdapterError?.cause;
  return error.code === 'P2010' && cause?.originalCode === '23505';
};

type AskedQuestion = Prisma.AskedQuestionGetPayload<object>;

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

/** Locks the session row and reads what transitions need (one round trip). */
async function lockSession(tx: Prisma.TransactionClient, id: string) {
  const [session] = await tx.$queryRaw<
    Array<{
      id: string;
      quizId: string;
      hostUserId: string;
      state: LiveSessionState;
    }>
  >`SELECT id::text, "quizId"::text, "hostUserId"::text, state::text
    FROM live_quiz_sessions WHERE id = ${id}::uuid FOR UPDATE`;
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

  /**
   * Sessions matching `where`, with their quiz details, in one round trip
   * instead of Prisma's per-relation queries (this runs on every join, sync
   * and host command). The only place a `LiveSessionRow` is built.
   */
  private async selectSessions(where: Prisma.Sql): Promise<LiveSessionRow[]> {
    const rows = await this.db.$queryRaw<
      Array<{
        id: string;
        quizId: string;
        hostUserId: string;
        state: LiveSessionState;
        allowLateJoin: boolean;
        startedAt: Date | null;
        endedAt: Date | null;
        createdAt: Date;
        finalLeaderboardShownAt: Date | null;
        publicId: string;
        title: string;
        plannedStartAt: Date | null;
        registrationLimit: number;
        defaultQuestionDurationSeconds: number;
        projectName: string;
        creatorName: string;
        questionCount: number;
        registrationCount: number;
      }>
    >`
      SELECT s.id::text, s."quizId"::text, s."hostUserId"::text,
        s.state::text, s."allowLateJoin", s."startedAt", s."endedAt",
        s."createdAt", s."finalLeaderboardShownAt", q."publicId", q.title,
        q."plannedStartAt",
        q."registrationLimit", q."defaultQuestionDurationSeconds",
        p.name AS "projectName", u.name AS "creatorName",
        (SELECT COUNT(*) FROM questions WHERE "quizId" = q.id)::int
          AS "questionCount",
        (SELECT COUNT(*) FROM quiz_registrations
          WHERE "quizId" = q.id
            AND status = ${REGISTRATION_STATUS.REGISTERED}::"RegistrationStatus"
        )::int AS "registrationCount"
      FROM live_quiz_sessions s
      JOIN quizzes q ON q.id = s."quizId"
      JOIN projects p ON p.id = q."projectId"
      JOIN users u ON u.id = q."creatorUserId"
      WHERE ${where}
      LIMIT 1`;
    return rows.map((row) => ({
      id: row.id,
      quizId: row.quizId,
      hostUserId: row.hostUserId,
      state: row.state,
      allowLateJoin: row.allowLateJoin,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
      createdAt: row.createdAt,
      finalLeaderboardShownAt: row.finalLeaderboardShownAt,
      quiz: {
        id: row.quizId,
        publicId: row.publicId,
        title: row.title,
        plannedStartAt: row.plannedStartAt,
        registrationLimit: row.registrationLimit,
        defaultQuestionDurationSeconds: row.defaultQuestionDurationSeconds,
        project: { name: row.projectName },
        creator: { name: row.creatorName },
        _count: {
          questions: row.questionCount,
          registrations: row.registrationCount,
        },
      },
    }));
  }

  async findById(id: string) {
    const [session] = await this.selectSessions(Prisma.sql`s.id = ${id}::uuid`);
    return session ?? null;
  }

  /** The quiz's unfinished session (at most one, by a partial unique index). */
  async findActiveForQuiz(quizId: string) {
    const [session] = await this.selectSessions(
      Prisma.sql`s."quizId" = ${quizId}::uuid AND ${unfinished}`,
    );
    return session ?? null;
  }

  /** The host's unfinished session (at most one, by a partial unique index). */
  async findActiveForHost(hostUserId: string) {
    const [session] = await this.selectSessions(
      Prisma.sql`s."hostUserId" = ${hostUserId}::uuid AND ${unfinished}`,
    );
    return session ?? null;
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

  /**
   * Records an entry. A first entry has equal first and last join times;
   * a return visit only moves `lastJoinedAt`.
   */
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
      // Persist final results once, from asked questions only. All asked
      // questions are closed above, so every answer is final.
      await tx.$executeRaw`
        INSERT INTO quiz_results
          (id, "liveSessionId", "userId", "totalScore", rank,
           "correctCount", "incorrectCount", "notAttemptedCount")
        SELECT gen_random_uuid(), ${id}::uuid, r."userId", r."totalScore",
          r.rank, r."correctCount", r."incorrectCount", r."notAttemptedCount"
        FROM (${finalResultRows(id)}) r
        ON CONFLICT ("liveSessionId", "userId") DO NOTHING`;
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

  // ---- Final results ---------------------------------------------------------

  /** Marks the final leaderboard as revealed (completed sessions only). */
  async showFinalLeaderboard(id: string) {
    const { count } = await this.db.liveQuizSession.updateMany({
      where: { id, state: LIVE_SESSION_STATE.COMPLETED },
      data: { finalLeaderboardShownAt: new Date() },
    });
    if (count === 0) invalidTransition();
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

  /**
   * The most recently asked question (active or just ended), without its
   * content: the service attaches the question from its quiz cache.
   */
  latestAsked(liveSessionId: string) {
    return this.db.askedQuestion.findFirst({
      where: { liveSessionId },
      orderBy: { sequenceNumber: 'desc' },
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
  /** Ids of every unfinished session (lobby or running). */
  async unfinishedSessionIds() {
    const rows = await this.db.$queryRaw<{ id: string }[]>`
      SELECT s.id FROM live_quiz_sessions s WHERE ${unfinished}`;
    return rows.map((row) => row.id);
  }

  allActiveAsked() {
    return this.db.askedQuestion.findMany({
      where: { status: ASKED_QUESTION_STATUS.ACTIVE },
      select: { id: true, liveSessionId: true, endsAt: true },
    });
  }

  /**
   * LIVE_IDLE or QUESTION_RESULT to QUESTION_ACTIVE; the timer starts now.
   * The service has already checked the question belongs to the quiz; the
   * unique keys reject a reused question or a second active one.
   */
  async startQuestion(id: string, questionId: string, durationSeconds: number) {
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + durationSeconds * 1000);
    // One atomic statement (one round trip). The conditional UPDATE takes the
    // session row lock and only matches an idle session, so concurrent starts
    // serialize and the loser matches nothing. Asking from the leaderboard
    // hides it implicitly. A reused question violates the unique key and the
    // whole statement, including the state change, rolls back.
    let rows: AskedQuestion[];
    try {
      rows = await this.db.$queryRaw<AskedQuestion[]>`
        WITH session AS (
          UPDATE live_quiz_sessions
          SET state = ${LIVE_SESSION_STATE.QUESTION_ACTIVE}::"LiveSessionState",
            "updatedAt" = now()
          WHERE id = ${id}::uuid
            AND state IN (
              ${LIVE_SESSION_STATE.LIVE_IDLE}::"LiveSessionState",
              ${LIVE_SESSION_STATE.QUESTION_RESULT}::"LiveSessionState",
              ${LIVE_SESSION_STATE.LEADERBOARD}::"LiveSessionState"
            )
          RETURNING id
        )
        INSERT INTO asked_questions
          (id, "liveSessionId", "questionId", "sequenceNumber", status,
           "durationSeconds", "startedAt", "endsAt")
        SELECT gen_random_uuid(), session.id, ${questionId}::uuid,
          (SELECT COUNT(*) FROM asked_questions
            WHERE "liveSessionId" = ${id}::uuid) + 1,
          ${ASKED_QUESTION_STATUS.ACTIVE}::"AskedQuestionStatus",
          ${durationSeconds}::int, ${startedAt}, ${endsAt}
        FROM session
        RETURNING id::text, "liveSessionId"::text, "questionId"::text,
          "sequenceNumber", status::text, "durationSeconds", "startedAt",
          "endsAt", "completedAt", "createdAt"`;
    } catch (error) {
      if (isUniqueViolation(error)) throw alreadyAsked();
      throw error;
    }
    const [asked] = rows;
    if (!asked) invalidTransition();
    return asked;
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
   * Rows of the shared ranking (`rankedStandings`). Pass `userId` to read one
   * participant's row from the same ranking.
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
      SELECT * FROM (${rankedStandings(liveSessionId)}) ranked
      WHERE ${userId ?? null}::uuid IS NULL OR ranked."userId" = ${userId ?? null}::text`;
    return rows;
  }

  /**
   * Top of the shared ranking with names: at most `size` rows, only
   * participants who have scored (a field of zero-point ties is not a
   * leaderboard), ties ordered by name. The participant count and the
   * latest completed question come from the same round trip.
   */
  async leaderboard(liveSessionId: string, size: number) {
    const [row] = await this.db.$queryRaw<
      Array<{
        participantCount: number;
        lastQuestion: number | null;
        entries: Array<{
          userId: string;
          name: string;
          totalScore: number;
          rank: number;
        }>;
      }>
    >`
      WITH ranked AS (${rankedStandings(liveSessionId)}),
      top AS (
        SELECT ranked."userId", u.name, ranked."totalScore", ranked.rank
        FROM ranked
        JOIN users u ON u.id = ranked."userId"::uuid
        WHERE ranked."totalScore" > 0
        ORDER BY ranked.rank ASC, u.name ASC
        LIMIT ${size}
      )
      SELECT
        (SELECT COUNT(*) FROM ranked)::int AS "participantCount",
        (SELECT MAX("sequenceNumber") FROM asked_questions
          WHERE "liveSessionId" = ${liveSessionId}::uuid
            AND status = ${ASKED_QUESTION_STATUS.COMPLETED}::"AskedQuestionStatus"
        )::int AS "lastQuestion",
        COALESCE(
          (SELECT json_agg(top ORDER BY top.rank ASC, top.name ASC) FROM top),
          '[]'::json
        ) AS entries`;
    return row ?? { participantCount: 0, lastQuestion: null, entries: [] };
  }

  /**
   * QUESTION_RESULT to LEADERBOARD and back as one conditional update: it
   * changes only presentation state, so a single atomic statement replaces
   * the lock and transaction (any concurrent transition simply fails it).
   */
  async setLeaderboard(id: string, shown: boolean) {
    const { count } = await this.db.liveQuizSession.updateMany({
      where: {
        id,
        state: shown
          ? LIVE_SESSION_STATE.QUESTION_RESULT
          : LIVE_SESSION_STATE.LEADERBOARD,
      },
      data: {
        state: shown
          ? LIVE_SESSION_STATE.LEADERBOARD
          : LIVE_SESSION_STATE.QUESTION_RESULT,
      },
    });
    if (count === 0) invalidTransition();
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
      include: { options: { orderBy: { position: 'asc' } }, image: true },
    });
  }
}
