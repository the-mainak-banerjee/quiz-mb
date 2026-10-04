import type { ResultsService } from '../results/service.js';
import {
  type HostDashboardDto,
  type HostRegistrationDto,
  type ParticipantDashboardDto,
  QUIZ_STATUS,
  REGISTRATION_STATUS,
  type RegistrationDto,
} from '@quizmb/contracts';
import {
  DOMAIN_EVENT,
  type DomainEvents,
} from '../../infrastructure/domain-events.js';
import type { QuizzesService } from '../quizzes/service.js';
import type { RegistrationsRepository } from './repository.js';

export class RegistrationsService {
  constructor(
    private repository: RegistrationsRepository,
    private quizzes: QuizzesService,
    private events?: DomainEvents,
    private results?: ResultsService,
  ) {}

  async register(quizId: string, userId: string): Promise<RegistrationDto> {
    const result = await this.repository.register(quizId, userId);
    this.events?.emit(DOMAIN_EVENT.registrationChanged, {
      quizId,
      userId,
      registered: true,
    });
    return {
      registered: true,
      registeredAt: result.registration.registeredAt.toISOString(),
      registrationCount: result.registrationCount,
      completedLiveSessionId: null,
    };
  }

  async unregister(quizId: string, userId: string): Promise<RegistrationDto> {
    const result = await this.repository.unregister(quizId, userId);
    this.events?.emit(DOMAIN_EVENT.registrationChanged, {
      quizId,
      userId,
      registered: false,
    });
    return {
      registered: false,
      registeredAt: null,
      registrationCount: result.registrationCount,
      completedLiveSessionId: null,
    };
  }

  async own(quizId: string, userId: string): Promise<RegistrationDto> {
    const result = await this.repository.own(quizId, userId);
    const active =
      result.registration?.status === REGISTRATION_STATUS.REGISTERED;
    return {
      registered: active,
      registeredAt: active
        ? result.registration!.registeredAt.toISOString()
        : null,
      registrationCount: result.registrationCount,
      completedLiveSessionId: active ? result.completedLiveSessionId : null,
    };
  }

  async hostList(
    quizId: string,
    userId: string,
    cursor: string | undefined,
    limit: number,
  ) {
    const rows = await this.repository.hostList(quizId, userId, cursor, limit);
    const data: HostRegistrationDto[] = rows.slice(0, limit).map((row) => ({
      id: row.id,
      userId: row.user.id,
      name: row.user.name,
      registeredAt: row.registeredAt.toISOString(),
    }));
    return {
      data,
      meta: { nextCursor: rows.length > limit ? rows[limit - 1]!.id : null },
    };
  }

  async hostListAll(
    quizId: string,
    userId: string,
  ): Promise<HostRegistrationDto[]> {
    const rows = await this.repository.hostListAll(quizId, userId);
    return rows.map((row) => ({
      id: row.id,
      userId: row.user.id,
      name: row.user.name,
      registeredAt: row.registeredAt.toISOString(),
    }));
  }

  async participantDashboard(userId: string): Promise<ParticipantDashboardDto> {
    const [upcoming, live, history] = await Promise.all([
      this.repository.upcoming(userId, [QUIZ_STATUS.PUBLISHED]),
      this.repository.upcoming(userId, [QUIZ_STATUS.LOBBY, QUIZ_STATUS.LIVE]),
      this.results?.history(userId) ?? Promise.resolve([]),
    ]);
    const toDto = (rows: typeof upcoming) =>
      Promise.all(rows.map((row) => this.quizzes.publicDto(row.quiz)));
    return {
      upcoming: await toDto(upcoming),
      live: await toDto(live),
      history: await Promise.all(
        history.map(async (item) => ({
          ...item,
          quiz: await this.quizzes.publicDto(item.quiz),
        })),
      ),
    };
  }

  async hostDashboard(userId: string): Promise<HostDashboardDto> {
    const { projects, quizzes } = await this.repository.hostDashboard(userId);
    return {
      projects: projects.map((project) => ({
        id: project.id,
        title: project.name,
        quizzes: project._count.quizzes,
        members: project._count.associations + 1,
      })),
      quizzes: quizzes.map((quiz) => ({
        id: quiz.id,
        publicId: quiz.publicId,
        projectId: quiz.projectId,
        projectName: quiz.project.name,
        title: quiz.title,
        description: quiz.description,
        status: quiz.status,
        plannedStartAt: quiz.plannedStartAt?.toISOString() ?? null,
        updatedAt: quiz.updatedAt.toISOString(),
        questionCount: quiz._count.questions,
        registrationCount: quiz._count.registrations,
      })),
    };
  }
}
