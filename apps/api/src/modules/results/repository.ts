import type { PrismaClient } from '@quizmb/database';
import {
  LIVE_SESSION_STATE,
  QUESTION_TYPE,
  REGISTRATION_STATUS,
} from '@quizmb/contracts';
import { publicQuizInclude } from '../quizzes/repository.js';

/** One participant's saved final result. */
export type ResultRow = {
  userId: string;
  totalScore: number;
  rank: number;
  correctCount: number;
  incorrectCount: number;
  notAttemptedCount: number;
};

/**
 * Reads saved final results (`quiz_results`). Rows are written once, by the
 * live-session module, when a quiz ends; nothing here recalculates scores.
 */
export class ResultsRepository {
  constructor(private db: PrismaClient) {}

  /** Totals for a completed session, in one round trip. */
  async summary(liveSessionId: string) {
    const [row] = await this.db.$queryRaw<
      Array<{
        participantCount: number;
        askedQuestionCount: number;
        scoredQuestionCount: number;
      }>
    >`
      SELECT
        (SELECT COUNT(*) FROM quiz_results
          WHERE "liveSessionId" = ${liveSessionId}::uuid)::int
          AS "participantCount",
        COUNT(aq.id)::int AS "askedQuestionCount",
        COUNT(aq.id) FILTER (
          WHERE q.type <> ${QUESTION_TYPE.DESCRIPTIVE}::"QuestionType"
        )::int AS "scoredQuestionCount"
      FROM asked_questions aq
      JOIN questions q ON q.id = aq."questionId"
      WHERE aq."liveSessionId" = ${liveSessionId}::uuid`;
    return (
      row ?? {
        participantCount: 0,
        askedQuestionCount: 0,
        scoredQuestionCount: 0,
      }
    );
  }

  /** Every participant's result (for personal delivery when a quiz ends). */
  all(liveSessionId: string) {
    return this.db.$queryRaw<ResultRow[]>`
      SELECT "userId"::text, "totalScore", rank, "correctCount",
        "incorrectCount", "notAttemptedCount"
      FROM quiz_results WHERE "liveSessionId" = ${liveSessionId}::uuid`;
  }

  /**
   * Final Top N with the live leaderboard's rules: participants who scored,
   * ties ordered by name.
   */
  leaderboard(liveSessionId: string, size: number) {
    return this.db.$queryRaw<
      Array<{ userId: string; name: string; totalScore: number; rank: number }>
    >`
      SELECT r."userId"::text, u.name, r."totalScore", r.rank
      FROM quiz_results r
      JOIN users u ON u.id = r."userId"
      WHERE r."liveSessionId" = ${liveSessionId}::uuid AND r."totalScore" > 0
      ORDER BY r.rank ASC, u.name ASC
      LIMIT ${size}`;
  }

  /** One page of every participant's result, in rank order. */
  page(liveSessionId: string, offset: number, limit: number) {
    return this.db.$queryRaw<Array<ResultRow & { name: string }>>`
      SELECT r."userId"::text, u.name, r."totalScore", r.rank,
        r."correctCount", r."incorrectCount", r."notAttemptedCount"
      FROM quiz_results r
      JOIN users u ON u.id = r."userId"
      WHERE r."liveSessionId" = ${liveSessionId}::uuid
      ORDER BY r.rank ASC, u.name ASC, r."userId" ASC
      OFFSET ${offset} LIMIT ${limit}`;
  }

  /** The quiz's completed session, if `hostUserId` created the quiz. */
  hostSession(quizId: string, hostUserId: string) {
    return this.db.liveQuizSession.findFirst({
      where: {
        quizId,
        state: LIVE_SESSION_STATE.COMPLETED,
        quiz: { creatorUserId: hostUserId },
      },
      orderBy: { endedAt: 'desc' },
      select: {
        id: true,
        endedAt: true,
        quiz: {
          select: {
            id: true,
            publicId: true,
            title: true,
            project: { select: { name: true } },
          },
        },
      },
    });
  }

  /**
   * A completed session as seen by one user: the quiz, whether they were
   * registered, and their saved result (null if they never entered).
   */
  async participantSession(liveSessionId: string, userId: string) {
    const session = await this.db.liveQuizSession.findFirst({
      where: { id: liveSessionId, state: LIVE_SESSION_STATE.COMPLETED },
      select: {
        id: true,
        endedAt: true,
        quiz: {
          select: {
            id: true,
            publicId: true,
            title: true,
            project: { select: { name: true } },
            creator: { select: { name: true } },
            registrations: {
              where: { userId, status: REGISTRATION_STATUS.REGISTERED },
              select: { id: true },
            },
          },
        },
        results: { where: { userId } },
      },
    });
    if (!session) return null;
    const [result] = session.results;
    const participantCount = result
      ? await this.db.quizResult.count({ where: { liveSessionId } })
      : 0;
    return { session, result: result ?? null, participantCount };
  }

  /** The user's completed quizzes with results and quiz cards, newest first. */
  async history(userId: string) {
    const rows = await this.db.quizResult.findMany({
      where: { userId },
      orderBy: { finalizedAt: 'desc' },
      include: {
        liveSession: {
          select: {
            endedAt: true,
            quiz: { include: publicQuizInclude },
            _count: { select: { results: true } },
          },
        },
      },
    });
    return rows;
  }
}
