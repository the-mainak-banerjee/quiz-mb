import {
  type ActiveHostSessionDto,
  ANSWER_STATUS,
  type AnswerSubmitCommand,
  ASKED_QUESTION_STATUS,
  ERROR_CODE,
  type HostCurrentQuestionDto,
  type HostQuestionProgressDto,
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
import { ApiError } from '../../http/api-error.js';
import {
  DOMAIN_EVENT,
  type DomainEvents,
} from '../../infrastructure/domain-events.js';
import type { MediaService } from '../media/service.js';
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
import { LOCK_OPERATION } from './constants.js';

/** Host snapshots list at most this many registrations; counts stay exact. */
export const HOST_ROSTER_LIMIT = 100;

const notFound = () =>
  new ApiError(404, ERROR_CODE.SESSION_NOT_FOUND, 'Live session not found.');

/** Timers fire slightly after the deadline so the close never runs early. */
const CLOSE_GRACE_MS = 50;
/** Retries for a timer-driven close that failed on a transient error. */
const CLOSE_RETRY_MS = 2_000;
const CLOSE_MAX_RETRIES = 5;

const QUESTION_STATES: readonly string[] = [
  LIVE_SESSION_STATE.QUESTION_ACTIVE,
  LIVE_SESSION_STATE.QUESTION_RESULT,
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
  /** One close timer per session with an active question (in process). */
  private timers = new Map<string, NodeJS.Timeout>();
  /** Signed image URLs per asked question, valid for an hour. */
  private imageUrls = new Map<string, string | null>();
  /**
   * Hot-path caches so an answer costs one database round trip: answer keys
   * per asked question, and participants whose registration was confirmed
   * (registration is frozen once the quiz is live).
   */
  private answerKeys = new Map<string, AnswerKey>();
  private confirmed = new Map<string, Set<string>>();
  /** Quiz content per started session; it is locked once the quiz starts. */
  private questionCache = new Map<
    string,
    Awaited<ReturnType<LiveSessionsRepository['hostQuestions']>>
  >();

  private async quizQuestions(session: LiveSessionRow) {
    const cached = this.questionCache.get(session.id);
    if (cached) return cached;
    const questions = await this.repository.hostQuestions(session.quizId);
    if (session.state !== LIVE_SESSION_STATE.LOBBY)
      this.questionCache.set(session.id, questions);
    return questions;
  }

  /** Forgets in-memory state for a session that has finished. */
  private forget(liveSessionId: string) {
    this.clearTimer(liveSessionId);
    this.confirmed.delete(liveSessionId);
    this.questionCache.delete(liveSessionId);
    for (const [id, key] of this.answerKeys)
      if (key.liveSessionId === liveSessionId) this.answerKeys.delete(id);
  }

  constructor(
    private repository: LiveSessionsRepository,
    private store: LiveStore,
    readonly tickets: SocketTickets,
    private events?: DomainEvents,
    private media?: Pick<MediaService, 'dto'>,
  ) {}

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
  async issueWatchTicket(quizId: string, userId: string) {
    await this.quizStatus(quizId);
    return this.tickets.issueWatch(userId, quizId);
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
    const cached = this.imageUrls.get(asked.id);
    if (cached !== undefined) return cached;
    const media = await this.media.dto(asked.question.image).catch(() => null);
    this.imageUrls.set(asked.id, media?.url ?? null);
    return media?.url ?? null;
  }

  private async participantQuestion(
    asked: AskedQuestionRow,
  ): Promise<ParticipantQuestionStateDto> {
    const { question } = asked;
    let reveal: LiveQuestionRevealDto | null = null;
    if (asked.status === ASKED_QUESTION_STATUS.COMPLETED) {
      const progress = await this.repository.progress(asked.id, false);
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

  private async questionProgress(
    askedQuestionId: string,
    type: QuestionType,
  ): Promise<HostQuestionProgressDto> {
    const progress = await this.repository.progress(
      askedQuestionId,
      type === QUESTION_TYPE.DESCRIPTIVE,
    );
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
      ...(await this.questionProgress(asked.id, asked.question.type)),
      questionId: asked.questionId,
      number: asked.sequenceNumber,
      durationSeconds: asked.durationSeconds,
      startedAt: asked.startedAt.toISOString(),
      endsAt: asked.endsAt.toISOString(),
      ended: asked.status === ASKED_QUESTION_STATUS.COMPLETED,
    };
  }

  /** Host-only progress for throttled realtime updates. */
  async progressFor(askedQuestionId: string) {
    const type =
      this.answerKeys.get(askedQuestionId)?.type ??
      (await this.repository.findAsked(askedQuestionId))?.question.type;
    return type ? this.questionProgress(askedQuestionId, type) : null;
  }

  /** `preloaded` skips reloading the current question (undefined = load). */
  async hostSnapshot(
    session: LiveSessionRow,
    preloaded?: AskedQuestionRow | null,
  ): Promise<HostLiveSnapshotDto> {
    const [connectedIds, roster, questions, asked, current] = await Promise.all(
      [
        this.store.connectedUserIds(session.id),
        this.repository.roster(session.quizId, HOST_ROSTER_LIMIT),
        this.quizQuestions(session),
        this.repository.askedQuestions(session.id),
        preloaded === undefined ? this.currentAsked(session) : preloaded,
      ],
    );
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
    const [connected, asked] = await Promise.all([
      this.store.connectedCount(session.id),
      preloaded === undefined ? this.currentAsked(session) : preloaded,
    ]);
    const snapshot: ParticipantLiveSnapshotDto = {
      ...this.base(session, connected),
      role: LIVE_ROLE.PARTICIPANT,
      question: asked ? await this.participantQuestion(asked) : null,
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
    const [host, shared, presence, asked] = await Promise.all([
      this.hostSnapshot(session),
      this.participantSnapshot(session),
      this.store.presence(liveSessionId),
      this.currentAsked(session),
    ]);
    const submissions = asked
      ? new Map(
          (await this.repository.submissions(asked.id)).map((submission) => [
            submission.userId,
            submission,
          ]),
        )
      : new Map<string, SubmissionRow>();
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

  private clearTimer(liveSessionId: string) {
    clearTimeout(this.timers.get(liveSessionId));
    this.timers.delete(liveSessionId);
  }

  /** Closes the session's active question once its deadline has passed. */
  private schedule(liveSessionId: string, endsAt: Date, attempt = 0) {
    this.clearTimer(liveSessionId);
    const timer = setTimeout(
      () => {
        this.timers.delete(liveSessionId);
        this.closeExpired(liveSessionId).catch(() => {
          if (attempt < CLOSE_MAX_RETRIES)
            this.schedule(
              liveSessionId,
              new Date(Date.now() + CLOSE_RETRY_MS),
              attempt + 1,
            );
        });
      },
      Math.max(0, endsAt.getTime() - Date.now()) + CLOSE_GRACE_MS,
    );
    timer.unref();
    this.timers.set(liveSessionId, timer);
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
    this.clearTimer(liveSessionId);
    this.answerKeys.delete(active.id);
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
      this.schedule(asked.liveSessionId, asked.endsAt);
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

  async issueTicket(liveSessionId: string, userId: string) {
    const session = await this.load(liveSessionId);
    await this.roleFor(session, userId);
    return this.tickets.issue(userId, liveSessionId);
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
    if (role === LIVE_ROLE.HOST)
      return {
        role,
        snapshot: await this.hostSnapshot(session),
        replacedSocketId: null,
        newlyConnected: false,
      };
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
    await this.repository.recordJoin(session.id, userId);
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
    const session = await this.current(await this.load(liveSessionId));
    this.requireHost(session, userId);
    const question = (await this.quizQuestions(session)).find(
      (item) => item.id === questionId,
    );
    if (!question)
      throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Question not found.');
    const asked = await this.store.withLock(
      LOCK_OPERATION.SESSION_TRANSITION,
      liveSessionId,
      () =>
        this.repository.startQuestion(
          liveSessionId,
          questionId,
          question.durationOverrideSeconds ??
            session.quiz.defaultQuestionDurationSeconds,
        ),
    );
    this.imageUrls.clear();
    this.answerKeys.set(asked.id, {
      liveSessionId,
      quizId: session.quizId,
      hostUserId: session.hostUserId,
      type: question.type,
      options: question.options,
      startedAt: asked.startedAt,
      endsAt: asked.endsAt,
    });
    this.schedule(liveSessionId, asked.endsAt);
    return {
      session: { ...session, state: LIVE_SESSION_STATE.QUESTION_ACTIVE },
      asked: { ...asked, question } satisfies AskedQuestionRow,
    };
  }

  /** Cached answer key; reloaded after a restart. Null once closed. */
  private async answerKey(askedQuestionId: string) {
    const cached = this.answerKeys.get(askedQuestionId);
    if (cached) return cached;
    const asked = await this.repository.findAsked(askedQuestionId);
    if (!asked) return null;
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
    this.answerKeys.set(askedQuestionId, key);
    return key;
  }

  private async isConfirmedParticipant(
    liveSessionId: string,
    quizId: string,
    userId: string,
  ) {
    const known = this.confirmed.get(liveSessionId);
    if (known?.has(userId)) return true;
    if (!(await this.repository.registration(quizId, userId))) return false;
    this.confirmed.set(liveSessionId, (known ?? new Set()).add(userId));
    return true;
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
    const key = await this.answerKey(command.askedQuestionId);
    if (!key || key.liveSessionId !== command.liveSessionId)
      throw questionNotActive();
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
