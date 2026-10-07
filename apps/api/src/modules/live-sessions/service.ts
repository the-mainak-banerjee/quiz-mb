import {
  type ActiveHostSessionDto,
  ANSWER_STATUS,
  type AnswerSubmitCommand,
  ASKED_QUESTION_STATUS,
  ERROR_CODE,
  type HostCurrentQuestionDto,
  type HostQuestionProgressDto,
  LEADERBOARD_SIZE,
  type FinalSummaryDto,
  type LeaderboardDto,
  type HostLiveSnapshotDto,
  LIVE_ROLE,
  LIVE_SESSION_STATE,
  type LiveQuizInfoDto,
  type LiveRole,
  type LiveSessionRefDto,
  type LiveSnapshotDto,
  type LiveQuestionRevealDto,
  type ParticipantAnswerDto,
  type ParticipantLiveSnapshotDto,
  type ParticipantQuestionStateDto,
  type ParticipantStandingDto,
  QUESTION_TYPE,
  type QuestionType,
  QUIZ_STATUS,
  type QuizStatusDto,
} from '@quizmb/contracts';
import type { Logger } from 'pino';
import { ApiError } from '../../http/api-error.js';
import {
  DOMAIN_EVENT,
  type DomainEvents,
} from '../../infrastructure/domain-events.js';
import type { MediaService } from '../media/service.js';
import { ResultsRepository } from '../results/repository.js';
import { ResultsService } from '../results/service.js';
import { evaluateAnswer } from './answers.js';
import { pointsFor } from './scoring.js';
import type { LiveStore } from './live-store.js';
import type {
  AskedQuestionRow,
  LiveSessionRow,
  LiveSessionsRepository,
  SubmissionRow,
} from './repository.js';
import type { SocketTickets } from './tickets.js';
import { HOST_AWAY_GRACE_MS, LOCK_OPERATION } from './constants.js';

/** Host snapshots list at most this many registrations; counts stay exact. */
export const HOST_ROSTER_LIMIT = 100;

const notFound = () =>
  new ApiError(404, ERROR_CODE.SESSION_NOT_FOUND, 'Live session not found.');

/** Timers fire slightly after the deadline so the close never runs early. */
const CLOSE_GRACE_MS = 50;
/** Retries for a timer-driven close that failed on a transient error. */
const CLOSE_RETRY_MS = 2_000;
const CLOSE_MAX_RETRIES = 5;

/** Signed image URLs live an hour; reuse them for a little less. */
const IMAGE_URL_CACHE_MS = 50 * 60_000;
/** A failed signing is retried on a later snapshot, not cached for long. */
const IMAGE_URL_RETRY_MS = 30_000;
/** Session caches unused this long are dropped (abandoned sessions). */
const CACHE_IDLE_MS = 2 * 60 * 60_000;
/** How often idle session caches are swept, lazily on cache access. */
const CACHE_SWEEP_MS = 10 * 60_000;

/** States in which the latest asked question stays on screen. */
const QUESTION_STATES: readonly string[] = [
  LIVE_SESSION_STATE.QUESTION_ACTIVE,
  LIVE_SESSION_STATE.QUESTION_RESULT,
  LIVE_SESSION_STATE.LEADERBOARD,
];

const questionNotActive = () =>
  new ApiError(
    409,
    ERROR_CODE.QUESTION_NOT_ACTIVE,
    'This question is not active.',
  );

/** Immutable facts about an asked question needed to accept answers. */
type AnswerKey = {
  liveSessionId: string;
  quizId: string;
  hostUserId: string;
  type: QuestionType;
  options: Array<{ id: string; isCorrect: boolean }>;
  startedAt: Date;
  endsAt: Date;
};

type HostQuestions = Awaited<
  ReturnType<LiveSessionsRepository['hostQuestions']>
>;
type Progress = Awaited<ReturnType<LiveSessionsRepository['progress']>>;

/**
 * In-process caches for one live session (single API instance). Everything
 * here can be rebuilt from PostgreSQL, so dropping an entry is always safe.
 */
type SessionCache = {
  lastUsedAt: number;
  /** Quiz content; it is locked once the quiz starts. */
  questions?: HostQuestions;
  /** Participants whose registration was confirmed (frozen once live). */
  confirmed: Set<string>;
  /** Answer keys per asked question, so an answer costs one round trip. */
  answerKeys: Map<string, AnswerKey>;
  /** Signed image URL of the latest asked question. */
  image?: { askedQuestionId: string; url: string | null; expiresAt: number };
  /**
   * Values that cannot change until the next question ends: the ended
   * question's final progress (submissions are closed) and the leaderboard
   * (standings move only when a question ends or someone new enters).
   * Promises, so concurrent host and participant snapshots share one query.
   */
  finalProgress?:
    { askedQuestionId: string; progress: Promise<Progress> } | undefined;
  board?: Promise<LeaderboardDto> | undefined;
};

const submissionClosed = () =>
  new ApiError(
    409,
    ERROR_CODE.SUBMISSION_CLOSED,
    'Time is up. Answers for this question are closed.',
  );

/** A participant's own answer; correctness stays hidden until it ends. */
function answerDto(
  asked: Pick<AskedQuestionRow, 'id' | 'status'>,
  submission: SubmissionRow | null,
): ParticipantAnswerDto | null {
  const ended = asked.status === ASKED_QUESTION_STATUS.COMPLETED;
  if (!submission)
    return ended
      ? {
          askedQuestionId: asked.id,
          status: ANSWER_STATUS.NOT_ATTEMPTED,
          selectedOptionIds: [],
          answerText: null,
          isCorrect: null,
          pointsAwarded: 0,
        }
      : null;
  return {
    askedQuestionId: asked.id,
    status: submission.status,
    selectedOptionIds: submission.options.map(
      (option) => option.questionOptionId,
    ),
    answerText: submission.answerText,
    isCorrect: ended ? submission.isCorrect : null,
    pointsAwarded: ended ? submission.pointsAwarded : 0,
  };
}

export class LiveSessionsService {
  /** The close timer of each session's active question (in process). */
  private timers = new Map<
    string,
    { askedQuestionId: string; timer: NodeJS.Timeout }
  >();
  private caches = new Map<string, SessionCache>();
  private lastSweepAt = Date.now();
  /** Connected host sockets per session (in process; one API instance). */
  private hostSockets = new Map<string, Set<string>>();
  /** When each session's host closed its last connection. */
  private hostAwaySince = new Map<string, number>();

  /** The session's caches, created on first use; sweeps idle ones. */
  private cacheFor(liveSessionId: string) {
    const now = Date.now();
    if (now - this.lastSweepAt > CACHE_SWEEP_MS) {
      this.lastSweepAt = now;
      for (const [id, cache] of this.caches)
        if (now - cache.lastUsedAt > CACHE_IDLE_MS) this.caches.delete(id);
    }
    let cache = this.caches.get(liveSessionId);
    if (!cache) {
      cache = { lastUsedAt: now, confirmed: new Set(), answerKeys: new Map() };
      this.caches.set(liveSessionId, cache);
    }
    cache.lastUsedAt = now;
    return cache;
  }

  private async quizQuestions(session: LiveSessionRow) {
    const cache = this.cacheFor(session.id);
    if (cache.questions) return cache.questions;
    const questions = await this.repository.hostQuestions(session.quizId);
    if (session.state !== LIVE_SESSION_STATE.LOBBY) cache.questions = questions;
    return questions;
  }

  /** Forgets in-memory state for a session that has finished. */
  private forget(liveSessionId: string) {
    this.clearTimer(liveSessionId);
    this.caches.delete(liveSessionId);
    this.hostAwaySince.delete(liveSessionId);
  }

  // ---- Host presence -------------------------------------------------------

  /** Records a host socket; true when the host had no connection before. */
  private hostArrived(liveSessionId: string, socketId: string) {
    let sockets = this.hostSockets.get(liveSessionId);
    if (!sockets) {
      sockets = new Set();
      this.hostSockets.set(liveSessionId, sockets);
    }
    const returned = sockets.size === 0;
    sockets.add(socketId);
    this.hostAwaySince.delete(liveSessionId);
    return returned;
  }

  /** Forgets a host socket; true when it was the host's last connection. */
  hostLeft(liveSessionId: string, socketId: string) {
    const sockets = this.hostSockets.get(liveSessionId);
    if (!sockets?.delete(socketId) || sockets.size) return false;
    this.hostSockets.delete(liveSessionId);
    this.hostAwaySince.set(liveSessionId, Date.now());
    return true;
  }

  /**
   * Whether participants should see the host as connected: a live host
   * socket, or one that dropped less than the grace period ago. A host who
   * has not connected since the API started counts as away.
   */
  hostConnected(liveSessionId: string) {
    if (this.hostSockets.get(liveSessionId)?.size) return true;
    const since = this.hostAwaySince.get(liveSessionId);
    return since !== undefined && Date.now() - since < HOST_AWAY_GRACE_MS;
  }

  /**
   * Startup: no socket survives a restart, so presence recorded for
   * unfinished sessions is stale. Clients claim it again on reconnect;
   * attendance itself is stored in PostgreSQL and is unaffected.
   */
  async resetPresence() {
    const ids = await this.repository.unfinishedSessionIds();
    await this.store.resetPresence(ids);
    return ids.length;
  }

  constructor(
    private repository: LiveSessionsRepository,
    private store: LiveStore,
    readonly tickets: SocketTickets,
    private events?: DomainEvents,
    private media?: Pick<MediaService, 'dto'>,
    private logger?: Pick<Logger, 'info' | 'warn' | 'error'>,
  ) {
    this.results = new ResultsService(new ResultsRepository(repository.db));
  }

  /** Saved final results; written by `end`, read through this service. */
  private results: ResultsService;

  /** Lifecycle changes are published in-process for the status namespace. */
  private publishStatus(quizId: string, status: QuizStatusDto['status']) {
    this.events?.emit(DOMAIN_EVENT.quizStatusChanged, { quizId, status });
  }

  /** Current public lifecycle status; drafts are not watchable. */
  async quizStatus(quizId: string): Promise<QuizStatusDto> {
    const quiz = await this.repository.publicStatus(quizId);
    if (!quiz) throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Quiz not found.');
    return { quizId: quiz.id, status: quiz.status as QuizStatusDto['status'] };
  }

  /** Watch tickets reveal only public status, so any signed-in user qualifies. */
  async issueWatchTicket(quizId: string, userId: string, authFamilyId: string) {
    await this.quizStatus(quizId);
    return this.tickets.issueWatch(userId, quizId, authFamilyId);
  }

  private async load(liveSessionId: string) {
    const session = await this.repository.findById(liveSessionId);
    if (!session) throw notFound();
    return session;
  }

  /** Server-side role resolution; the client never asserts its own role. */
  private async roleFor(session: LiveSessionRow, userId: string) {
    if (session.hostUserId === userId) return LIVE_ROLE.HOST;
    if (await this.repository.registration(session.quizId, userId))
      return LIVE_ROLE.PARTICIPANT;
    throw new ApiError(
      403,
      ERROR_CODE.REGISTRATION_REQUIRED,
      'Register for this quiz to join its live session.',
    );
  }

  private requireHost(session: LiveSessionRow, userId: string) {
    if (session.hostUserId !== userId)
      throw new ApiError(
        403,
        ERROR_CODE.FORBIDDEN,
        'Only the quiz host can control this live session.',
      );
  }

  private quizInfo(session: LiveSessionRow): LiveQuizInfoDto {
    const { quiz } = session;
    return {
      id: quiz.id,
      publicId: quiz.publicId,
      title: quiz.title,
      projectName: quiz.project.name,
      hostName: quiz.creator.name,
      plannedStartAt: quiz.plannedStartAt?.toISOString() ?? null,
      registrationLimit: quiz.registrationLimit,
      questionCount: quiz._count.questions,
      defaultQuestionDurationSeconds: quiz.defaultQuestionDurationSeconds,
    };
  }

  private base(session: LiveSessionRow, connected: number) {
    return {
      liveSessionId: session.id,
      serverTime: new Date().toISOString(),
      state: session.state,
      allowLateJoin: session.allowLateJoin,
      startedAt: session.startedAt?.toISOString() ?? null,
      endedAt: session.endedAt?.toISOString() ?? null,
      quiz: this.quizInfo(session),
      counts: {
        connected,
        registered: session.quiz._count.registrations,
      },
    };
  }

  // ---- Questions -----------------------------------------------------------

  /** The active or just-ended question while the session is in one. */
  askedFor(session: LiveSessionRow) {
    return this.currentAsked(session);
  }

  private async currentAsked(
    session: LiveSessionRow,
  ): Promise<AskedQuestionRow | null> {
    if (!QUESTION_STATES.includes(session.state)) return null;
    const [asked, questions] = await Promise.all([
      this.repository.latestAsked(session.id),
      this.quizQuestions(session),
    ]);
    const question = questions.find((item) => item.id === asked?.questionId);
    return asked && question ? { ...asked, question } : null;
  }

  private async imageUrl(asked: AskedQuestionRow) {
    if (!asked.question.image || !this.media) return null;
    const cache = this.cacheFor(asked.liveSessionId);
    const cached = cache.image;
    if (cached?.askedQuestionId === asked.id && cached.expiresAt > Date.now())
      return cached.url;
    const media = await this.media.dto(asked.question.image).catch(() => null);
    const url = media?.url ?? null;
    cache.image = {
      askedQuestionId: asked.id,
      url,
      expiresAt: Date.now() + (url ? IMAGE_URL_CACHE_MS : IMAGE_URL_RETRY_MS),
    };
    return url;
  }

  private async participantQuestion(
    asked: AskedQuestionRow,
  ): Promise<ParticipantQuestionStateDto> {
    const { question } = asked;
    let reveal: LiveQuestionRevealDto | null = null;
    if (asked.status === ASKED_QUESTION_STATUS.COMPLETED) {
      const progress = await this.progressOf(asked);
      reveal = {
        correctOptionIds: question.options
          .filter((option) => option.isCorrect)
          .map((option) => option.id),
        distribution: progress.distribution,
        submittedCount: progress.submittedCount,
      };
    }
    return {
      askedQuestionId: asked.id,
      number: asked.sequenceNumber,
      type: question.type,
      text: question.text,
      imageUrl: await this.imageUrl(asked),
      options: question.options.map(({ id, text }) => ({ id, text })),
      durationSeconds: asked.durationSeconds,
      startedAt: asked.startedAt.toISOString(),
      endsAt: asked.endsAt.toISOString(),
      reveal,
    };
  }

  /** Progress of an asked question; final once it has ended, so cached. */
  private progressOf(asked: AskedQuestionRow) {
    const load = () =>
      this.repository.progress(
        asked.id,
        asked.question.type === QUESTION_TYPE.DESCRIPTIVE,
      );
    if (asked.status !== ASKED_QUESTION_STATUS.COMPLETED) return load();
    const cache = this.cacheFor(asked.liveSessionId);
    if (cache.finalProgress?.askedQuestionId === asked.id)
      return cache.finalProgress.progress;
    const progress = load();
    const entry = { askedQuestionId: asked.id, progress };
    cache.finalProgress = entry;
    progress.catch(() => {
      if (cache.finalProgress === entry) cache.finalProgress = undefined;
    });
    return progress;
  }

  private toProgressDto(
    askedQuestionId: string,
    progress: Progress,
  ): HostQuestionProgressDto {
    return {
      askedQuestionId,
      submittedCount: progress.submittedCount,
      distribution: progress.distribution,
      responses: progress.responses.map((response) => ({
        id: response.id,
        text: response.answerText ?? '',
        submittedAt: response.submittedAt?.toISOString() ?? '',
      })),
    };
  }

  private async hostCurrent(
    asked: AskedQuestionRow,
  ): Promise<HostCurrentQuestionDto> {
    return {
      ...this.toProgressDto(asked.id, await this.progressOf(asked)),
      questionId: asked.questionId,
      number: asked.sequenceNumber,
      durationSeconds: asked.durationSeconds,
      startedAt: asked.startedAt.toISOString(),
      endsAt: asked.endsAt.toISOString(),
      ended: asked.status === ASKED_QUESTION_STATUS.COMPLETED,
    };
  }

  /** Top standings with names (at most LEADERBOARD_SIZE, scorers only). */
  leaderboard(liveSessionId: string): Promise<LeaderboardDto> {
    const cache = this.cacheFor(liveSessionId);
    if (cache.board) return cache.board;
    const board = this.loadLeaderboard(liveSessionId);
    cache.board = board;
    board.catch(() => {
      if (cache.board === board) cache.board = undefined;
    });
    return board;
  }

  private async loadLeaderboard(
    liveSessionId: string,
  ): Promise<LeaderboardDto> {
    const board = await this.repository.leaderboard(
      liveSessionId,
      LEADERBOARD_SIZE,
    );
    return {
      entries: board.entries.map(({ rank, userId, name, totalScore }) => ({
        rank,
        userId,
        name,
        score: totalScore,
      })),
      participantCount: board.participantCount,
      afterQuestionNumber: board.lastQuestion,
    };
  }

  /** What participants see as the leaderboard right now, if anything. */
  private shownLeaderboard(session: LiveSessionRow) {
    if (session.state === LIVE_SESSION_STATE.LEADERBOARD)
      return this.leaderboard(session.id);
    if (
      session.state === LIVE_SESSION_STATE.COMPLETED &&
      session.finalLeaderboardShownAt
    )
      return this.finalBoard(session).then(({ leaderboard }) => leaderboard);
    return Promise.resolve(null);
  }

  // ---- Final results (completed sessions) ------------------------------------

  /** Totals and the final Top 10, read from saved results. */
  private async finalBoard(session: LiveSessionRow): Promise<{
    summary: FinalSummaryDto;
    leaderboard: LeaderboardDto;
  }> {
    const summary = await this.results.summary(session.id, session.endedAt);
    return {
      summary,
      leaderboard: await this.results.leaderboard(session.id, summary),
    };
  }

  private async hostFinal(session: LiveSessionRow) {
    if (session.state !== LIVE_SESSION_STATE.COMPLETED) return null;
    return {
      ...(await this.finalBoard(session)),
      leaderboardShown: session.finalLeaderboardShownAt !== null,
    };
  }

  /**
   * Each connected participant's own final result, sent when the quiz ends.
   * There is no rejoining afterwards; history shows it from then on.
   */
  async finalResultDeliveries(liveSessionId: string) {
    const [presence, results] = await Promise.all([
      this.store.presence(liveSessionId),
      this.results.all(liveSessionId),
    ]);
    return [...results].flatMap(([userId, result]) => {
      const socketId = presence.get(userId);
      return socketId ? [{ socketId, result }] : [];
    });
  }

  /** Host reveals the final Top 10 on participant screens (after End). */
  async showFinalLeaderboard(liveSessionId: string, userId: string) {
    const session = await this.load(liveSessionId);
    this.requireHost(session, userId);
    await this.repository.showFinalLeaderboard(liveSessionId);
    return { ...session, finalLeaderboardShownAt: new Date() };
  }

  /** Host-only progress for throttled realtime updates. */
  async progressFor(liveSessionId: string, askedQuestionId: string) {
    let type =
      this.cacheFor(liveSessionId).answerKeys.get(askedQuestionId)?.type;
    if (!type) {
      const asked = await this.repository.findAsked(askedQuestionId);
      if (asked?.liveSessionId === liveSessionId) type = asked.question.type;
    }
    return type
      ? this.toProgressDto(
          askedQuestionId,
          await this.repository.progress(
            askedQuestionId,
            type === QUESTION_TYPE.DESCRIPTIVE,
          ),
        )
      : null;
  }

  /** `preloaded` skips reloading the current question (undefined = load). */
  async hostSnapshot(
    session: LiveSessionRow,
    preloaded?: AskedQuestionRow | null,
  ): Promise<HostLiveSnapshotDto> {
    const [
      connectedIds,
      roster,
      questions,
      asked,
      current,
      leaderboard,
      final,
    ] = await Promise.all([
      this.store.connectedUserIds(session.id),
      this.repository.roster(session.quizId, HOST_ROSTER_LIMIT),
      this.quizQuestions(session),
      this.repository.askedQuestions(session.id),
      preloaded === undefined ? this.currentAsked(session) : preloaded,
      this.shownLeaderboard(session),
      this.hostFinal(session),
    ]);
    return {
      ...this.base(session, connectedIds.size),
      role: LIVE_ROLE.HOST,
      roster: roster.map((registration) => ({
        userId: registration.user.id,
        name: registration.user.name,
        connected: connectedIds.has(registration.user.id),
        registeredAt: registration.registeredAt.toISOString(),
      })),
      questions: questions.map((question) => ({
        id: question.id,
        position: question.position + 1,
        type: question.type,
        text: question.text,
        durationSeconds:
          question.durationOverrideSeconds ??
          session.quiz.defaultQuestionDurationSeconds,
        options: question.options.map((option) => ({
          id: option.id,
          text: option.text,
          isCorrect: option.isCorrect,
        })),
      })),
      askedQuestions: asked.map((item) => ({
        askedQuestionId: item.id,
        questionId: item.questionId,
        number: item.sequenceNumber,
      })),
      currentQuestion: current ? await this.hostCurrent(current) : null,
      leaderboard,
      final,
    };
  }

  /**
   * Shared participant snapshot. With `userId` it also carries that
   * participant's own answer; without it the personal fields are absent so
   * broadcasts never overwrite them on clients.
   */
  async participantSnapshot(
    session: LiveSessionRow,
    userId?: string,
    preloaded?: AskedQuestionRow | null,
  ): Promise<ParticipantLiveSnapshotDto> {
    const [connected, asked, leaderboard] = await Promise.all([
      this.store.connectedCount(session.id),
      preloaded === undefined ? this.currentAsked(session) : preloaded,
      this.shownLeaderboard(session),
    ]);
    const snapshot: ParticipantLiveSnapshotDto = {
      ...this.base(session, connected),
      role: LIVE_ROLE.PARTICIPANT,
      question: asked ? await this.participantQuestion(asked) : null,
      leaderboard,
      hostConnected: this.hostConnected(session.id),
    };
    if (userId === undefined) return snapshot;
    if (!asked)
      return {
        ...snapshot,
        myAnswer: null,
        joinedDuringQuestion: false,
        myStanding: null,
      };
    const ended = asked.status === ASKED_QUESTION_STATUS.COMPLETED;
    const [submission, participation, standing] = await Promise.all([
      this.repository.submissionFor(asked.id, userId),
      this.repository.participation(session.id, userId),
      ended
        ? this.repository.standings(session.id, userId)
        : Promise.resolve([]),
    ]);
    const [mine] = standing;
    return {
      ...snapshot,
      myAnswer: answerDto(asked, submission),
      joinedDuringQuestion:
        !!participation && participation.firstJoinedAt > asked.startedAt,
      myStanding: mine
        ? {
            askedQuestionId: asked.id,
            totalScore: mine.totalScore,
            rank: mine.rank,
            participantCount: mine.participantCount,
          }
        : null,
    };
  }

  /**
   * Recalculated score and rank for each connected participant after a
   * question ended. Sent after the reveal, so clients show the reveal first
   * while their standing loads.
   */
  async standingDeliveries(liveSessionId: string, askedQuestionId: string) {
    const [presence, rows] = await Promise.all([
      this.store.presence(liveSessionId),
      this.repository.standings(liveSessionId),
    ]);
    return rows.flatMap((row) => {
      const socketId = presence.get(row.userId);
      if (!socketId) return [];
      const standing: ParticipantStandingDto = {
        askedQuestionId,
        totalScore: row.totalScore,
        rank: row.rank,
        participantCount: row.participantCount,
      };
      return [{ socketId, standing }];
    });
  }

  snapshotFor(
    session: LiveSessionRow,
    role: LiveRole,
    userId: string,
  ): Promise<LiveSnapshotDto> {
    return role === LIVE_ROLE.HOST
      ? this.hostSnapshot(session)
      : this.participantSnapshot(session, userId);
  }

  /**
   * After a question closes: the host snapshot plus one personal snapshot
   * per connected participant socket (each sees only their own answer).
   */
  async questionEndedDeliveries(liveSessionId: string) {
    const session = await this.load(liveSessionId);
    // Resolved once and shared, so every snapshot shows the same question.
    const asked = await this.currentAsked(session);
    const [host, shared, presence, rows] = await Promise.all([
      this.hostSnapshot(session, asked),
      this.participantSnapshot(session, undefined, asked),
      this.store.presence(liveSessionId),
      asked ? this.repository.submissions(asked.id) : Promise.resolve([]),
    ]);
    const submissions = new Map<string, SubmissionRow>(
      rows.map((submission) => [submission.userId, submission]),
    );
    const participants = [...presence].map(([userId, socketId]) => ({
      socketId,
      snapshot: {
        ...shared,
        myAnswer: asked
          ? answerDto(asked, submissions.get(userId) ?? null)
          : null,
      } satisfies ParticipantLiveSnapshotDto,
    }));
    return { host, participants };
  }

  // ---- Question timing -----------------------------------------------------

  /**
   * Cancels the session's close timer. With `askedQuestionId` only that
   * question's timer is cancelled, so a late caller finishing an older
   * question never disarms the timer of the one asked after it.
   */
  private clearTimer(liveSessionId: string, askedQuestionId?: string) {
    const entry = this.timers.get(liveSessionId);
    if (!entry) return;
    if (askedQuestionId && entry.askedQuestionId !== askedQuestionId) return;
    clearTimeout(entry.timer);
    this.timers.delete(liveSessionId);
  }

  /** Closes the asked question once its deadline has passed. */
  private schedule(
    liveSessionId: string,
    askedQuestionId: string,
    endsAt: Date,
    attempt = 0,
  ) {
    this.clearTimer(liveSessionId);
    const timer = setTimeout(
      () => {
        if (this.timers.get(liveSessionId)?.timer === timer)
          this.timers.delete(liveSessionId);
        this.closeExpired(liveSessionId).catch((error: unknown) => {
          const context = {
            liveSessionId,
            askedQuestionId,
            attempt,
            err: error,
          };
          if (attempt >= CLOSE_MAX_RETRIES) {
            // The next join, sync, submit or host action still closes it.
            this.logger?.error(context, 'Question close timer gave up');
            return;
          }
          this.logger?.warn(context, 'Question close failed; retrying');
          this.schedule(
            liveSessionId,
            askedQuestionId,
            new Date(Date.now() + CLOSE_RETRY_MS),
            attempt + 1,
          );
        });
      },
      Math.max(0, endsAt.getTime() - Date.now()) + CLOSE_GRACE_MS,
    );
    timer.unref();
    this.timers.set(liveSessionId, { askedQuestionId, timer });
  }

  /**
   * Recovery path shared by timers and every interaction: if the active
   * question is past its deadline, close it (exactly once) and announce it.
   */
  async closeExpired(liveSessionId: string) {
    const active = await this.repository.activeAsked(liveSessionId);
    if (!active || active.endsAt.getTime() > Date.now()) return false;
    const closed = await this.repository.finalizeQuestion(
      liveSessionId,
      active.id,
    );
    this.clearTimer(liveSessionId, active.id);
    const cache = this.caches.get(liveSessionId);
    if (cache) {
      cache.answerKeys.delete(active.id);
      // Standings change once the question has ended.
      cache.board = undefined;
    }
    if (closed)
      this.events?.emit(DOMAIN_EVENT.questionEnded, {
        liveSessionId,
        askedQuestionId: active.id,
      });
    return closed;
  }

  /** Re-arms timers after a restart; overdue questions close right away. */
  async recoverQuestionTimers() {
    const active = await this.repository.allActiveAsked();
    for (const asked of active)
      this.schedule(asked.liveSessionId, asked.id, asked.endsAt);
    return active.length;
  }

  /** Brings a session up to date before it is read or changed. */
  private async current(session: LiveSessionRow) {
    if (session.state !== LIVE_SESSION_STATE.QUESTION_ACTIVE) return session;
    return (await this.closeExpired(session.id))
      ? this.load(session.id)
      : session;
  }

  // ---- REST --------------------------------------------------------------

  async openLobby(quizId: string, hostUserId: string) {
    const id = await this.repository.openLobby(quizId, hostUserId);
    this.logger?.info({ liveSessionId: id, quizId }, 'Live lobby opened');
    this.publishStatus(quizId, QUIZ_STATUS.LOBBY);
    return this.ref(await this.load(id), LIVE_ROLE.HOST);
  }

  async currentForQuiz(
    quizId: string,
    userId: string,
  ): Promise<LiveSessionRefDto> {
    const session = await this.repository.findActiveForQuiz(quizId);
    if (!session) throw notFound();
    return this.ref(session, await this.roleFor(session, userId));
  }

  async activeForHost(
    hostUserId: string,
  ): Promise<ActiveHostSessionDto | null> {
    const session = await this.repository.findActiveForHost(hostUserId);
    if (!session) return null;
    return {
      id: session.id,
      quizId: session.quizId,
      quizTitle: session.quiz.title,
      projectName: session.quiz.project.name,
      state: session.state,
      createdAt: session.createdAt.toISOString(),
      startedAt: session.startedAt?.toISOString() ?? null,
      connected: await this.store.connectedCount(session.id),
      registered: session.quiz._count.registrations,
      questionCount: session.quiz._count.questions,
    };
  }

  async issueTicket(
    liveSessionId: string,
    userId: string,
    authFamilyId: string,
  ) {
    const session = await this.load(liveSessionId);
    await this.roleFor(session, userId);
    return this.tickets.issue(userId, liveSessionId, authFamilyId);
  }

  private ref(session: LiveSessionRow, role: LiveRole): LiveSessionRefDto {
    return {
      id: session.id,
      quizId: session.quizId,
      state: session.state,
      role,
    };
  }

  // ---- Realtime ----------------------------------------------------------

  /**
   * Validates entry and records attendance. Participants must be registered;
   * after the quiz starts, first-time entrants also need late joining on,
   * while returning attendees may always reconnect. The newest socket
   * replaces the user's previous one.
   */
  async join(liveSessionId: string, userId: string, socketId: string) {
    const session = await this.current(await this.load(liveSessionId));
    const role = await this.roleFor(session, userId);
    if (role === LIVE_ROLE.HOST) {
      const hostReturned = this.hostArrived(session.id, socketId);
      return {
        role,
        snapshot: await this.hostSnapshot(session),
        replacedSocketId: null,
        newlyConnected: false,
        hostReturned,
        firstEntry: false,
      };
    }
    if (session.state === LIVE_SESSION_STATE.COMPLETED)
      throw new ApiError(
        409,
        ERROR_CODE.QUIZ_COMPLETED,
        'This live quiz has ended.',
      );
    if (
      session.state !== LIVE_SESSION_STATE.LOBBY &&
      !session.allowLateJoin &&
      !(await this.repository.participation(session.id, userId))
    )
      throw new ApiError(
        403,
        ERROR_CODE.LATE_JOIN_DISABLED,
        'The host is not admitting new participants right now.',
      );
    const attendance = await this.repository.recordJoin(session.id, userId);
    // Only a first entry changes the participant count (and zero-score
    // ranks); reconnects keep the cached leaderboard.
    const firstEntry =
      attendance.firstJoinedAt.getTime() === attendance.lastJoinedAt.getTime();
    if (firstEntry) this.cacheFor(session.id).board = undefined;
    const replacedSocketId = await this.store.claimPresence(
      session.id,
      userId,
      socketId,
    );
    return {
      role,
      snapshot: await this.participantSnapshot(session, userId),
      replacedSocketId,
      newlyConnected: replacedSocketId === null,
      hostReturned: false,
      firstEntry,
    };
  }

  /** Current role-safe state for an already joined socket. */
  async sync(liveSessionId: string, userId: string, role: LiveRole) {
    const session = await this.current(await this.load(liveSessionId));
    // Re-derive the role: a participant who unregistered is refused here.
    const current = await this.roleFor(session, userId);
    if (current !== role) throw notFound();
    return this.snapshotFor(session, role, userId);
  }

  /**
   * Applies a registration change to the quiz's open session, if any. An
   * unregistered participant loses presence and attendance; the returned
   * socket (if connected) must be removed by the transport.
   */
  async applyRegistrationChange(
    quizId: string,
    userId: string,
    registered: boolean,
  ) {
    const session = await this.repository.findActiveForQuiz(quizId);
    if (!session) return null;
    let removedSocketId: string | null = null;
    if (!registered) {
      removedSocketId = await this.store.evictPresence(session.id, userId);
      await this.repository.removeParticipation(session.id, userId);
    }
    return { session, removedSocketId };
  }

  isActiveSocket(liveSessionId: string, userId: string, socketId: string) {
    return this.store
      .activeSocket(liveSessionId, userId)
      .then((active) => active === socketId);
  }

  /** Returns the new connected count when this socket's presence ended. */
  async leave(liveSessionId: string, userId: string, socketId: string) {
    const removed = await this.store.releasePresence(
      liveSessionId,
      userId,
      socketId,
    );
    return removed ? this.store.connectedCount(liveSessionId) : null;
  }

  private async hostTransition(
    liveSessionId: string,
    userId: string,
    change: () => Promise<unknown>,
  ) {
    const session = await this.load(liveSessionId);
    this.requireHost(session, userId);
    await this.store.withLock(
      LOCK_OPERATION.SESSION_TRANSITION,
      liveSessionId,
      change,
    );
    return this.load(liveSessionId);
  }

  async start(liveSessionId: string, userId: string) {
    const session = await this.hostTransition(liveSessionId, userId, () =>
      this.repository.start(liveSessionId),
    );
    this.publishStatus(session.quizId, QUIZ_STATUS.LIVE);
    return session;
  }

  setLateJoin(liveSessionId: string, userId: string, allow: boolean) {
    return this.hostTransition(liveSessionId, userId, () =>
      this.repository.setLateJoin(liveSessionId, allow),
    );
  }

  /** Host closes a lobby before starting; returns the quiz id. */
  async closeLobby(liveSessionId: string, userId: string) {
    const session = await this.load(liveSessionId);
    this.requireHost(session, userId);
    const quizId = await this.store.withLock(
      LOCK_OPERATION.SESSION_TRANSITION,
      liveSessionId,
      () => this.repository.closeLobby(liveSessionId),
    );
    await this.store.clearPresence(liveSessionId);
    this.forget(liveSessionId);
    this.publishStatus(quizId, QUIZ_STATUS.PUBLISHED);
    return quizId;
  }

  /**
   * Asks any unused question; it starts now for everyone in the room.
   * Returns the updated session and the new question so the caller can
   * broadcast without reloading either.
   */
  async startQuestion(
    liveSessionId: string,
    userId: string,
    questionId: string,
  ) {
    const loaded = await this.load(liveSessionId);
    // Authorize before current(), which can close a question and broadcast.
    this.requireHost(loaded, userId);
    const session = await this.current(loaded);
    const question = (await this.quizQuestions(session)).find(
      (item) => item.id === questionId,
    );
    if (!question)
      throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Question not found.');
    // No Redis lock: the single conditional statement already serializes
    // concurrent starts on the session row.
    const asked = await this.repository.startQuestion(
      liveSessionId,
      questionId,
      question.durationOverrideSeconds ??
        session.quiz.defaultQuestionDurationSeconds,
    );
    this.cacheFor(liveSessionId).answerKeys.set(asked.id, {
      liveSessionId,
      quizId: session.quizId,
      hostUserId: session.hostUserId,
      type: question.type,
      options: question.options,
      startedAt: asked.startedAt,
      endsAt: asked.endsAt,
    });
    this.schedule(liveSessionId, asked.id, asked.endsAt);
    return {
      session: { ...session, state: LIVE_SESSION_STATE.QUESTION_ACTIVE },
      asked: { ...asked, question } satisfies AskedQuestionRow,
    };
  }

  /**
   * Cached answer key; reloaded after a restart. Null when the question is
   * not part of this session, checked before its status so other sessions'
   * questions reveal nothing. Throws once the question has closed.
   */
  private async answerKey(liveSessionId: string, askedQuestionId: string) {
    const cache = this.cacheFor(liveSessionId);
    const cached = cache.answerKeys.get(askedQuestionId);
    if (cached) return cached;
    const asked = await this.repository.findAsked(askedQuestionId);
    if (!asked || asked.liveSessionId !== liveSessionId) return null;
    if (asked.status !== ASKED_QUESTION_STATUS.ACTIVE) throw submissionClosed();
    const key: AnswerKey = {
      liveSessionId: asked.liveSessionId,
      quizId: asked.liveSession.quizId,
      hostUserId: asked.liveSession.hostUserId,
      type: asked.question.type,
      options: asked.question.options,
      startedAt: asked.startedAt,
      endsAt: asked.endsAt,
    };
    cache.answerKeys.set(askedQuestionId, key);
    return key;
  }

  private async isConfirmedParticipant(
    liveSessionId: string,
    quizId: string,
    userId: string,
  ) {
    const { confirmed } = this.cacheFor(liveSessionId);
    if (confirmed.has(userId)) return true;
    if (!(await this.repository.registration(quizId, userId))) return false;
    confirmed.add(userId);
    return true;
  }

  /** Host-only private view; participants' screens do not change. */
  async hostLeaderboard(liveSessionId: string, userId: string) {
    const session = await this.load(liveSessionId);
    this.requireHost(session, userId);
    return this.leaderboard(liveSessionId);
  }

  /**
   * Shows or hides the Top 10 on participant screens (between questions).
   * Only the state changes, so the session is not reloaded afterwards.
   */
  async setLeaderboard(liveSessionId: string, userId: string, shown: boolean) {
    const session = await this.load(liveSessionId);
    this.requireHost(session, userId);
    await this.repository.setLeaderboard(liveSessionId, shown);
    return {
      ...session,
      state: shown
        ? LIVE_SESSION_STATE.LEADERBOARD
        : LIVE_SESSION_STATE.QUESTION_RESULT,
    };
  }

  /**
   * Accepts one explicit answer for the active question. Correctness is
   * decided here but returned only after the question ends.
   */
  async submit(
    userId: string,
    socketId: string,
    command: AnswerSubmitCommand,
  ): Promise<ParticipantAnswerDto> {
    const receivedAt = new Date();
    const key = await this.answerKey(
      command.liveSessionId,
      command.askedQuestionId,
    );
    if (!key) throw questionNotActive();
    if (key.hostUserId === userId)
      throw new ApiError(
        403,
        ERROR_CODE.FORBIDDEN,
        'The host cannot answer questions.',
      );
    if (receivedAt >= key.endsAt) {
      // Also closes the question if its timer has not fired yet.
      await this.closeExpired(key.liveSessionId).catch(() => false);
      throw submissionClosed();
    }
    const answer = evaluateAnswer(key, command);
    const [active, registered] = await Promise.all([
      this.isActiveSocket(key.liveSessionId, userId, socketId),
      this.isConfirmedParticipant(key.liveSessionId, key.quizId, userId),
    ]);
    if (!active)
      throw new ApiError(
        409,
        ERROR_CODE.SESSION_REPLACED,
        'This quiz is open on another device.',
      );
    if (!registered)
      throw new ApiError(
        403,
        ERROR_CODE.REGISTRATION_REQUIRED,
        'Register for this quiz to answer its questions.',
      );
    const responseTimeMs = receivedAt.getTime() - key.startedAt.getTime();
    await this.repository.submit({
      askedQuestionId: command.askedQuestionId,
      userId,
      ...answer,
      // Decided now, revealed only after the question ends.
      pointsAwarded: pointsFor(
        answer.isCorrect,
        responseTimeMs,
        key.endsAt.getTime() - key.startedAt.getTime(),
      ),
      submittedAt: receivedAt,
      responseTimeMs,
    });
    return {
      askedQuestionId: command.askedQuestionId,
      status: ANSWER_STATUS.SUBMITTED,
      selectedOptionIds: answer.selectedOptionIds,
      answerText: answer.answerText,
      isCorrect: null,
      pointsAwarded: 0,
    };
  }

  async end(liveSessionId: string, userId: string) {
    const session = await this.hostTransition(liveSessionId, userId, () =>
      this.repository.end(liveSessionId),
    );
    this.forget(liveSessionId);
    await this.store.expireCompleted(liveSessionId);
    this.publishStatus(session.quizId, QUIZ_STATUS.COMPLETED);
    return session;
  }
}
