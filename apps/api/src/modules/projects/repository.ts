import type { PrismaClient } from '@quizmb/database';
import {
  ERROR_CODE,
  MEDIA_STATUS,
  QUIZ_STATUS,
  type ProjectInput,
} from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';
import { lockedTransaction } from '../../infrastructure/transactions.js';

export class ProjectsRepository {
  constructor(private db: PrismaClient) {}
  list(ownerUserId: string, cursor?: string) {
    return this.db.project.findMany({
      where: { ownerUserId, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: 'asc' },
      take: 26,
      include: { _count: { select: { quizzes: true } } },
    });
  }
  get(id: string, ownerUserId: string) {
    return this.db.project.findFirst({
      where: { id, ownerUserId },
      include: { _count: { select: { quizzes: true } } },
    });
  }
  /**
   * Creates a project unless the owner already has `maxProjects`. The
   * owner's row is locked while counting, so simultaneous creations (other
   * tabs, scripts) cannot pass the limit.
   */
  create(ownerUserId: string, data: ProjectInput, maxProjects: number) {
    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${ownerUserId}::uuid FOR UPDATE`;
      const owned = await tx.project.count({ where: { ownerUserId } });
      if (owned >= maxProjects)
        throw new ApiError(
          409,
          ERROR_CODE.LIMIT_REACHED,
          `You can have up to ${maxProjects} projects. Delete one to create a new project.`,
        );
      return tx.project.create({
        data: { ...data, ownerUserId },
        include: { _count: { select: { quizzes: true } } },
      });
    }, lockedTransaction);
  }
  /**
   * Deletes a project whose quizzes are all drafts, together with them.
   * Locking the project and its quiz rows keeps a quiz from being published
   * or added meanwhile. Returns the storage paths of the deleted quizzes'
   * files, removed after the transaction commits.
   */
  remove(id: string, ownerUserId: string) {
    return this.db.$transaction(async (tx) => {
      const project = await tx.$queryRaw<{ id: string }[]>`
        SELECT id FROM projects
        WHERE id = ${id}::uuid AND "ownerUserId" = ${ownerUserId}::uuid
        FOR UPDATE`;
      if (!project.length)
        throw new ApiError(404, ERROR_CODE.NOT_FOUND, 'Project not found.');
      const quizzes = await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status::text AS status FROM quizzes
        WHERE "projectId" = ${id}::uuid
        FOR UPDATE`;
      if (quizzes.some((quiz) => quiz.status !== QUIZ_STATUS.DRAFT))
        throw new ApiError(
          409,
          ERROR_CODE.CONFLICT,
          'Only projects whose quizzes are all drafts can be deleted. This project has published or completed quizzes.',
        );
      const ids = quizzes.map((quiz) => quiz.id);
      const files = await tx.mediaAsset.findMany({
        where: { quizId: { in: ids }, status: { not: MEDIA_STATUS.DELETED } },
        select: { objectPath: true },
      });
      await tx.quiz.deleteMany({ where: { id: { in: ids } } });
      await tx.project.delete({ where: { id } });
      return files.map((file) => file.objectPath);
    }, lockedTransaction);
  }
  update(id: string, ownerUserId: string, data: ProjectInput) {
    return this.db.project.update({
      where: { id, ownerUserId },
      data,
      include: { _count: { select: { quizzes: true } } },
    });
  }
}
