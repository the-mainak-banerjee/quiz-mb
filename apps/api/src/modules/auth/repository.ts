import { Prisma, type PrismaClient } from '@quizmb/database';
export type SessionInput = {
  id: string;
  familyId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent: string | null;
};
export class AuthRepository {
  constructor(readonly db: PrismaClient) {}
  findByEmail(email: string) {
    return this.db.user.findUnique({ where: { email } });
  }
  async createAccount(
    input: { name: string; email: string; passwordHash: string },
    session: SessionInput,
  ) {
    try {
      return await this.db.user.create({
        data: { ...input, sessions: { create: session } },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return null;
      throw error;
    }
  }
  createSession(userId: string, data: SessionInput) {
    return this.db.authSession.create({
      data: { userId, ...data },
      include: { user: true },
    });
  }
  async rotate(hash: string, nextHash: string, now: Date) {
    return this.db.$transaction(async (tx) => {
      const current = await tx.authSession.findUnique({
        where: { refreshTokenHash: hash },
      });
      if (!current) return null;
      // Serialize rotations, logout and replay revocation on the family's root.
      await tx.$queryRaw`SELECT id FROM auth_sessions WHERE id = ${current.familyId}::uuid FOR UPDATE`;
      const row = await tx.authSession.findUniqueOrThrow({
        where: { id: current.id },
      });
      if (row.revokedAt) {
        await tx.authSession.updateMany({
          where: { familyId: row.familyId, revokedAt: null },
          data: { revokedAt: now },
        });
        return null; // Commit revocation before reporting the invalid credential.
      }
      if (row.expiresAt <= now) return null;
      await tx.authSession.update({
        where: { id: row.id },
        data: { revokedAt: now, lastUsedAt: now },
      });
      return tx.authSession.create({
        data: {
          userId: row.userId,
          familyId: row.familyId,
          refreshTokenHash: nextHash,
          expiresAt: row.expiresAt,
          userAgent: row.userAgent,
        },
        include: { user: true },
      });
    });
  }
  async revokeFamily(hash: string) {
    await this.db.$transaction(async (tx) => {
      const row = await tx.authSession.findUnique({
        where: { refreshTokenHash: hash },
      });
      if (!row) return;
      await tx.$queryRaw`SELECT id FROM auth_sessions WHERE id = ${row.familyId}::uuid FOR UPDATE`;
      await tx.authSession.updateMany({
        where: { familyId: row.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }
  activeSession(id: string, userId: string) {
    return this.db.authSession.findFirst({
      where: { id, userId, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
  }
}
