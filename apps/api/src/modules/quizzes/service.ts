import type { QuizInput, QuizDto } from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';
import type { QuizzesRepository, QuizRow } from './repository.js';
import type { MediaService } from '../media/service.js';
import type { ProjectsService } from '../projects/service.js';
export class QuizzesService {
  constructor(
    private repository: QuizzesRepository,
    private media: MediaService,
    private projects: ProjectsService,
  ) {}
  async dto(q: QuizRow): Promise<QuizDto> {
    return {
      id: q.id,
      projectId: q.projectId,
      projectName: q.project.name,
      publicId: q.publicId,
      title: q.title,
      description: q.description,
      registrationLimit: q.registrationLimit,
      defaultQuestionDurationSeconds: q.defaultQuestionDurationSeconds,
      allowLateJoin: q.allowLateJoin,
      coverMediaId: q.coverMediaId,
      plannedStartAt: q.plannedStartAt?.toISOString() ?? null,
      status: q.status,
      updatedAt: q.updatedAt.toISOString(),
      cover: await this.media.dto(q.cover),
      questions: await Promise.all(
        q.questions.map(async (item) => ({
          id: item.id,
          type: item.type,
          text: item.text,
          position: item.position,
          durationOverrideSeconds: item.durationOverrideSeconds,
          imageMediaId: item.imageMediaId,
          image: await this.media.dto(item.image),
          options: item.options.map((o) => ({
            text: o.text,
            isCorrect: o.isCorrect,
          })),
        })),
      ),
    };
  }
  async get(id: string, userId: string) {
    const q = await this.repository.get(id, userId);
    if (!q) throw new ApiError(404, 'NOT_FOUND', 'Quiz not found.');
    return this.dto(q);
  }
  async list(projectId: string, userId: string, cursor?: string) {
    await this.projects.get(projectId, userId);
    const rows = await this.repository.list(projectId, userId, cursor);
    return {
      data: rows.slice(0, 25).map((q) => ({
        id: q.id,
        projectId: q.projectId,
        title: q.title,
        status: q.status,
        updatedAt: q.updatedAt.toISOString(),
        questionCount: q._count.questions,
      })),
      meta: { nextCursor: rows.length > 25 ? rows[24]!.id : null },
    };
  }
  async create(projectId: string, userId: string, input: QuizInput) {
    return this.dto(await this.repository.create(projectId, userId, input));
  }
  async update(id: string, userId: string, input: QuizInput) {
    return this.dto(await this.repository.update(id, userId, input));
  }
}
