import type { PrismaClient } from '@quizmb/database';
import type { ProjectInput } from '@quizmb/contracts';

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
  create(ownerUserId: string, data: ProjectInput) {
    return this.db.project.create({
      data: { ...data, ownerUserId },
      include: { _count: { select: { quizzes: true } } },
    });
  }
  update(id: string, ownerUserId: string, data: ProjectInput) {
    return this.db.project.update({
      where: { id, ownerUserId },
      data,
      include: { _count: { select: { quizzes: true } } },
    });
  }
}
