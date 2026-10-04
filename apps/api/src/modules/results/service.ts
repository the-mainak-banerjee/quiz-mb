import {
  ERROR_CODE,
  LEADERBOARD_SIZE,
  RESULTS_PAGE_SIZE,
  type FinalSummaryDto,
  type HostQuizResultsDto,
  type LeaderboardDto,
  type ParticipantFinalResultDto,
  type ParticipantQuizResultDto,
} from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';
import type { ResultRow, ResultsRepository } from './repository.js';

const notFound = () =>
  new ApiError(404, ERROR_CODE.NOT_FOUND, 'Results not found.');

function toResult(
  row: Omit<ResultRow, 'userId'>,
  participantCount: number,
): ParticipantFinalResultDto {
  return {
    totalScore: row.totalScore,
    rank: row.rank,
    participantCount,
    correctCount: row.correctCount,
    incorrectCount: row.incorrectCount,
    notAttemptedCount: row.notAttemptedCount,
  };
}

/** Final results of completed live sessions (read-only). */
export class ResultsService {
  constructor(private repository: ResultsRepository) {}

  async summary(
    liveSessionId: string,
    completedAt: Date | null,
  ): Promise<FinalSummaryDto> {
    return {
      ...(await this.repository.summary(liveSessionId)),
      completedAt: completedAt?.toISOString() ?? null,
    };
  }

  /** Final Top 10 (scorers only, ties ordered by name). */
  async leaderboard(
    liveSessionId: string,
    summary: FinalSummaryDto,
  ): Promise<LeaderboardDto> {
    const top = await this.repository.leaderboard(
      liveSessionId,
      LEADERBOARD_SIZE,
    );
    return {
      entries: top.map(({ rank, userId, name, totalScore, correctCount }) => ({
        rank,
        userId,
        name,
        score: totalScore,
        correctCount,
      })),
      participantCount: summary.participantCount,
      afterQuestionNumber: summary.askedQuestionCount || null,
    };
  }

  /** Every participant's final result, keyed by user id. */
  async all(liveSessionId: string) {
    const rows = await this.repository.all(liveSessionId);
    return new Map(rows.map((row) => [row.userId, toResult(row, rows.length)]));
  }

  /** Host results page: summary plus one page of ranked participants. */
  async hostResults(
    quizId: string,
    hostUserId: string,
    offset: number,
  ): Promise<HostQuizResultsDto> {
    const session = await this.repository.hostSession(quizId, hostUserId);
    if (!session) throw notFound();
    const [summary, rows] = await Promise.all([
      this.summary(session.id, session.endedAt),
      // One extra row tells whether another page exists.
      this.repository.page(session.id, offset, RESULTS_PAGE_SIZE + 1),
    ]);
    const entries = rows.slice(0, RESULTS_PAGE_SIZE).map((row) => ({
      rank: row.rank,
      userId: row.userId,
      name: row.name,
      score: row.totalScore,
      correctCount: row.correctCount,
      incorrectCount: row.incorrectCount,
      notAttemptedCount: row.notAttemptedCount,
    }));
    return {
      liveSessionId: session.id,
      quiz: {
        id: session.quiz.id,
        publicId: session.quiz.publicId,
        title: session.quiz.title,
        projectName: session.quiz.project.name,
      },
      summary,
      entries,
      nextOffset:
        rows.length > RESULTS_PAGE_SIZE ? offset + RESULTS_PAGE_SIZE : null,
    };
  }

  /**
   * A participant's completed quiz summary. Registered users who never
   * entered get `result: null`; anyone else gets 404.
   */
  async participantResult(
    liveSessionId: string,
    userId: string,
  ): Promise<ParticipantQuizResultDto> {
    const found = await this.repository.participantSession(
      liveSessionId,
      userId,
    );
    if (
      !found ||
      (!found.result && found.session.quiz.registrations.length === 0)
    )
      throw notFound();
    const { session, result, participantCount } = found;
    return {
      liveSessionId: session.id,
      quiz: {
        id: session.quiz.id,
        publicId: session.quiz.publicId,
        title: session.quiz.title,
        projectName: session.quiz.project.name,
        hostName: session.quiz.creator.name,
      },
      startedAt: session.startedAt?.toISOString() ?? null,
      completedAt: session.endedAt?.toISOString() ?? null,
      result: result ? toResult(result, participantCount) : null,
    };
  }

  /** Completed quizzes the user registered for, with quiz rows for cards. */
  async history(userId: string) {
    const rows = await this.repository.history(userId);
    return rows.flatMap(({ quiz }) => {
      const [session] = quiz.liveSessions;
      if (!session) return [];
      const [result] = session.results;
      return [
        {
          liveSessionId: session.id,
          quiz,
          completedAt: session.endedAt?.toISOString() ?? null,
          result: result ? toResult(result, session._count.results) : null,
        },
      ];
    });
  }
}
