import type {
  ActiveHostSessionDto,
  HostLiveSnapshotDto,
  LiveQuizInfoDto,
  LiveRole,
  LiveSessionRefDto,
  LiveSnapshotDto,
  ParticipantLiveSnapshotDto,
} from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';
import type { LiveStore } from './live-store.js';
import type { LiveSessionRow, LiveSessionsRepository } from './repository.js';
import type { SocketTickets } from './tickets.js';

/** Host snapshots list at most this many registrations; counts stay exact. */
export const HOST_ROSTER_LIMIT = 100;

const notFound = () =>
  new ApiError(404, 'SESSION_NOT_FOUND', 'Live session not found.');

export class LiveSessionsService {
  constructor(
    private repository: LiveSessionsRepository,
    private store: LiveStore,
    readonly tickets: SocketTickets,
  ) {}

  private async load(liveSessionId: string) {
    const session = await this.repository.findById(liveSessionId);
    if (!session) throw notFound();
    return session;
  }

  /** Server-side role resolution; the client never asserts its own role. */
  private async roleFor(session: LiveSessionRow, userId: string) {
    if (session.hostUserId === userId) return 'HOST' as const;
    if (await this.repository.registration(session.quizId, userId))
      return 'PARTICIPANT' as const;
    throw new ApiError(
      403,
      'REGISTRATION_REQUIRED',
      'Register for this quiz to join its live session.',
    );
  }

  private requireHost(session: LiveSessionRow, userId: string) {
    if (session.hostUserId !== userId)
      throw new ApiError(
        403,
        'FORBIDDEN',
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

  async hostSnapshot(session: LiveSessionRow): Promise<HostLiveSnapshotDto> {
    const [connectedIds, roster, questions] = await Promise.all([
      this.store.connectedUserIds(session.id),
      this.repository.roster(session.quizId, HOST_ROSTER_LIMIT),
      this.repository.hostQuestions(session.quizId),
    ]);
    return {
      ...this.base(session, connectedIds.size),
      role: 'HOST',
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
    };
  }

  async participantSnapshot(
    session: LiveSessionRow,
  ): Promise<ParticipantLiveSnapshotDto> {
    return {
      ...this.base(session, await this.store.connectedCount(session.id)),
      role: 'PARTICIPANT',
    };
  }

  snapshotFor(
    session: LiveSessionRow,
    role: LiveRole,
  ): Promise<LiveSnapshotDto> {
    return role === 'HOST'
      ? this.hostSnapshot(session)
      : this.participantSnapshot(session);
  }

  // ---- REST --------------------------------------------------------------

  async openLobby(quizId: string, hostUserId: string) {
    const id = await this.repository.openLobby(quizId, hostUserId);
    return this.ref(await this.load(id), 'HOST');
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
    const session = await this.load(liveSessionId);
    const role = await this.roleFor(session, userId);
    if (role === 'HOST')
      return {
        role,
        snapshot: await this.hostSnapshot(session),
        replacedSocketId: null,
        newlyConnected: false,
      };
    if (session.state === 'COMPLETED')
      throw new ApiError(409, 'QUIZ_COMPLETED', 'This live quiz has ended.');
    if (
      session.state !== 'LOBBY' &&
      !session.allowLateJoin &&
      !(await this.repository.participation(session.id, userId))
    )
      throw new ApiError(
        403,
        'LATE_JOIN_DISABLED',
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
      snapshot: await this.participantSnapshot(session),
      replacedSocketId,
      newlyConnected: replacedSocketId === null,
    };
  }

  /** Current role-safe state for an already joined socket. */
  async sync(liveSessionId: string, userId: string, role: LiveRole) {
    return this.snapshotFor(await this.load(liveSessionId), role);
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
    await this.store.withLock('session-transition', liveSessionId, change);
    return this.load(liveSessionId);
  }

  start(liveSessionId: string, userId: string) {
    return this.hostTransition(liveSessionId, userId, () =>
      this.repository.start(liveSessionId),
    );
  }

  setLateJoin(liveSessionId: string, userId: string, allow: boolean) {
    return this.hostTransition(liveSessionId, userId, () =>
      this.repository.setLateJoin(liveSessionId, allow),
    );
  }

  async end(liveSessionId: string, userId: string) {
    const session = await this.hostTransition(liveSessionId, userId, () =>
      this.repository.end(liveSessionId),
    );
    await this.store.expireCompleted(liveSessionId);
    return session;
  }
}
