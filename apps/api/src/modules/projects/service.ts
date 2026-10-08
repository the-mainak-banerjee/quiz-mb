import { ERROR_CODE, type ProjectInput } from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';
import type { ProjectsRepository } from './repository.js';
import { limitsFor } from '../../config/account-limits.js';
import type { MediaService } from '../media/service.js';
type Row = NonNullable<Awaited<ReturnType<ProjectsRepository['get']>>>;
function dto(p: Row) {
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    quizCount: p._count.quizzes,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
export class ProjectsService {
  constructor(
    private repository: ProjectsRepository,
    private media?: Pick<MediaService, 'removeFiles'>,
  ) {}
  async list(userId: string, cursor?: string) {
    const rows = await this.repository.list(userId, cursor);
    return {
      data: rows.slice(0, 25).map(dto),
      meta: { nextCursor: rows.length > 25 ? rows[24]!.id : null },
    };
  }
  async get(id: string, userId: string) {
    const row = await this.repository.get(id, userId);
    if (!row)
      throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Project not found.');
    return dto(row);
  }
  async create(userId: string, input: ProjectInput) {
    const { projects } = await limitsFor(userId);
    return dto(await this.repository.create(userId, input, projects));
  }
  /** Deletes the project and its draft quizzes (see the repository). */
  async remove(id: string, userId: string) {
    const files = await this.repository.remove(id, userId);
    await this.media?.removeFiles(files);
  }
  async update(id: string, userId: string, input: ProjectInput) {
    await this.get(id, userId);
    return dto(await this.repository.update(id, userId, input));
  }
}
