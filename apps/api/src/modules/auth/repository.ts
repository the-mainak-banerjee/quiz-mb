import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@quizmb/database';
import { OTP_RULES, type OtpPurpose } from '@quizmb/contracts';
import type { CodeHasher } from './one-time-codes.js';

/** Result of checking a one-time code. */
export type CodeCheck =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'expired' | 'exhausted' }
  | { ok: false; reason: 'wrong'; attemptsLeft: number };
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
  findById(id: string) {
    return this.db.user.findUnique({ where: { id } });
  }
  /** A new account without a session; it signs in once verified. */
  async createUnverified(input: {
    name: string;
    email: string;
    passwordHash: string;
  }) {
    try {
      return await this.db.user.create({ data: input });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        return null;
      throw error;
    }
  }

  /**
   * Stores a new code for the user and purpose, replacing (and so deleting)
   * the previous one, unless the previous one was issued within the resend
   * cooldown. One statement, so concurrent requests cannot both send.
   * Returns null when issued, or when the next code may be requested.
   */
  async issueCode(
    userId: string,
    purpose: OtpPurpose,
    codeHash: string,
    expiresAt: Date,
  ): Promise<Date | null> {
    const cooldown = `${OTP_RULES.resendCooldownSeconds} seconds`;
    const rows = await this.db.$queryRaw<{ id: string }[]>`
      INSERT INTO verification_codes
        (id, "userId", purpose, "codeHash", "expiresAt", attempts, "createdAt")
      VALUES (${randomUUID()}::uuid, ${userId}::uuid, ${purpose}::"OtpPurpose",
        ${codeHash}, ${expiresAt}, 0, now())
      ON CONFLICT ("userId", purpose) DO UPDATE
        SET "codeHash" = EXCLUDED."codeHash", "expiresAt" = EXCLUDED."expiresAt",
            attempts = 0, "createdAt" = now()
        WHERE verification_codes."createdAt" <= now() - ${cooldown}::interval
      RETURNING id`;
    if (rows.length) return null;
    const current = await this.db.verificationCode.findUnique({
      where: { userId_purpose: { userId, purpose } },
      select: { createdAt: true },
    });
    return current
      ? new Date(
          current.createdAt.getTime() + OTP_RULES.resendCooldownSeconds * 1000,
        )
      : new Date();
  }

  /** When the user's current code for this purpose may be replaced. */
  async resendAvailableAt(userId: string, purpose: OtpPurpose) {
    const current = await this.db.verificationCode.findUnique({
      where: { userId_purpose: { userId, purpose } },
      select: { createdAt: true },
    });
    return new Date(
      (current?.createdAt.getTime() ?? 0) +
        OTP_RULES.resendCooldownSeconds * 1000,
    );
  }

  /**
   * Checks a code under a row lock. A correct, expired or exhausted code is
   * deleted, so it can never be used again; a wrong one counts an attempt.
   */
  checkCode(
    userId: string,
    purpose: OtpPurpose,
    candidateHash: string,
    hasher: CodeHasher,
  ): Promise<CodeCheck> {
    return this.db.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<
        { id: string; codeHash: string; expiresAt: Date; attempts: number }[]
      >`SELECT id, "codeHash", "expiresAt", attempts FROM verification_codes
        WHERE "userId" = ${userId}::uuid AND purpose = ${purpose}::"OtpPurpose"
        FOR UPDATE`;
      if (!row) return { ok: false, reason: 'missing' } as const;
      const remove = () =>
        tx.verificationCode.delete({ where: { id: row.id } });
      if (row.expiresAt <= new Date()) {
        await remove();
        return { ok: false, reason: 'expired' } as const;
      }
      if (hasher.matches(row.codeHash, candidateHash)) {
        await remove();
        return { ok: true } as const;
      }
      const attempts = row.attempts + 1;
      if (attempts >= OTP_RULES.maxAttempts) {
        await remove();
        return { ok: false, reason: 'exhausted' } as const;
      }
      await tx.verificationCode.update({
        where: { id: row.id },
        data: { attempts },
      });
      return {
        ok: false,
        reason: 'wrong',
        attemptsLeft: OTP_RULES.maxAttempts - attempts,
      } as const;
    });
  }

  /** Marks the email verified and starts the first session. */
  verifyAndSignIn(userId: string, session: SessionInput) {
    return this.db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { emailVerifiedAt: new Date() },
      });
      return tx.authSession.create({
        data: { userId, ...session },
        include: { user: true },
      });
    });
  }

  /**
   * Saves a new password, signs out every session and treats the email as
   * verified (the person proved they receive mail there).
   */
  async resetPassword(userId: string, passwordHash: string) {
    const now = new Date();
    await this.db.$transaction([
      this.db.user.update({
        where: { id: userId },
        data: { passwordHash },
      }),
      this.db.user.updateMany({
        where: { id: userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: now },
      }),
      this.db.authSession.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: now },
      }),
      this.db.verificationCode.deleteMany({ where: { userId } }),
    ]);
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
