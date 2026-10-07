import { randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient } from '@quizmb/database';
import { OTP_RULES, type OtpPurpose } from '@quizmb/contracts';
import type { CodeHasher } from './one-time-codes.js';

/** Result of checking a one-time code. */
export type CodeCheck =
  | { ok: true }
  | { ok: false; reason: 'missing' | 'expired' | 'exhausted' }
  | { ok: false; reason: 'wrong'; attemptsLeft: number }
  /** Too many wrong codes recently (across resends); retry at `retryAt`. */
  | { ok: false; reason: 'locked'; retryAt: Date };

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * When a rolling-window limit allows the next event: null when it already
 * does. `times` are the window's events, oldest first.
 */
function windowReopens(times: Date[], limit: number, windowMs: number) {
  if (times.length < limit) return null;
  // The oldest event that must age out before one more fits.
  return new Date(times[times.length - limit]!.getTime() + windowMs);
}
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
      // Wrong codes are counted per address and purpose across resends, under
      // the code's row lock, so parallel guesses cannot pass the limit.
      const failures = await tx.authEmailEvent.findMany({
        where: {
          userId,
          purpose,
          kind: 'CODE_FAILED',
          createdAt: {
            gt: new Date(Date.now() - OTP_RULES.failureWindowSeconds * 1000),
          },
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      });
      const retryAt = windowReopens(
        failures.map((failure) => failure.createdAt),
        OTP_RULES.failuresPerWindow,
        OTP_RULES.failureWindowSeconds * 1000,
      );
      if (retryAt) return { ok: false, reason: 'locked', retryAt } as const;
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
      await tx.authEmailEvent.create({
        data: { userId, purpose, kind: 'CODE_FAILED' },
      });
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

  /**
   * Marks the email verified and starts the first session. Only an
   * unverified account: a verification step shown for an existing verified
   * account (signup never reveals that it exists) can never sign in. Returns
   * null in that case.
   */
  verifyAndSignIn(userId: string, session: SessionInput) {
    return this.db.$transaction(async (tx) => {
      const { count } = await tx.user.updateMany({
        where: { id: userId, emailVerifiedAt: null },
        data: { emailVerifiedAt: new Date() },
      });
      if (!count) return null;
      return tx.authSession.create({
        data: { userId, ...session },
        include: { user: true },
      });
    });
  }

  /**
   * When the per-address send limits allow the next email for this purpose
   * (5 per hour and 10 per rolling 24 hours, including the first): null
   * when they already do.
   */
  async sendAllowedAt(userId: string, purpose: OtpPurpose) {
    const now = Date.now();
    const sends = (
      await this.db.authEmailEvent.findMany({
        where: {
          userId,
          purpose,
          kind: 'SENT',
          createdAt: { gt: new Date(now - DAY_MS) },
        },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      })
    ).map((send) => send.createdAt);
    const lastHour = sends.filter((time) => time.getTime() > now - HOUR_MS);
    const reopen = [
      windowReopens(lastHour, OTP_RULES.sendsPerHour, HOUR_MS),
      windowReopens(sends, OTP_RULES.sendsPerDay, DAY_MS),
    ].filter((time): time is Date => time !== null);
    return reopen.length
      ? new Date(Math.max(...reopen.map((time) => time.getTime())))
      : null;
  }

  /** Records an auth email sent to this account (a code or a notice). */
  async recordSend(userId: string, purpose: OtpPurpose) {
    await this.db.authEmailEvent.create({
      data: { userId, purpose, kind: 'SENT' },
    });
  }

  /** Auth emails sent since `since`, across every account. */
  sentSince(since: Date) {
    return this.db.authEmailEvent.count({
      where: { kind: 'SENT', createdAt: { gte: since } },
    });
  }

  /**
   * Deletes accounts that never verified their email and were created
   * before `before`, with their codes and email events (cascade). The
   * condition is checked by the DELETE itself, so an account verified at
   * that moment is kept. Verified accounts are never deleted.
   */
  async deleteNeverVerified(before: Date) {
    const { count } = await this.db.user.deleteMany({
      where: { emailVerifiedAt: null, createdAt: { lt: before } },
    });
    return count;
  }

  /** Drops email events no rolling window needs any more. */
  async deleteEmailEventsBefore(before: Date) {
    const { count } = await this.db.authEmailEvent.deleteMany({
      where: { createdAt: { lt: before } },
    });
    return count;
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
  /**
   * Exchanges a refresh token for the next one in its family. A reused
   * (already rotated) token revokes the whole family: `revokedFamilyId` says
   * which, so its open sockets can be disconnected.
   */
  async rotate(hash: string, nextHash: string, now: Date) {
    const refused = (revokedFamilyId: string | null = null) => ({
      session: null,
      revokedFamilyId,
    });
    return this.db.$transaction(async (tx) => {
      const current = await tx.authSession.findUnique({
        where: { refreshTokenHash: hash },
      });
      if (!current) return refused();
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
        // Commit revocation before reporting the invalid credential.
        return refused(row.familyId);
      }
      if (row.expiresAt <= now) return refused();
      await tx.authSession.update({
        where: { id: row.id },
        data: { revokedAt: now, lastUsedAt: now },
      });
      const session = await tx.authSession.create({
        data: {
          userId: row.userId,
          familyId: row.familyId,
          refreshTokenHash: nextHash,
          expiresAt: row.expiresAt,
          userAgent: row.userAgent,
        },
        include: { user: true },
      });
      return { session, revokedFamilyId: null };
    });
  }
  /** Revokes the refresh token's family; returns its id (null if unknown). */
  async revokeFamily(hash: string) {
    return this.db.$transaction(async (tx) => {
      const row = await tx.authSession.findUnique({
        where: { refreshTokenHash: hash },
      });
      if (!row) return null;
      await tx.$queryRaw`SELECT id FROM auth_sessions WHERE id = ${row.familyId}::uuid FOR UPDATE`;
      await tx.authSession.updateMany({
        where: { familyId: row.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return row.familyId;
    });
  }
  activeSession(id: string, userId: string) {
    return this.db.authSession.findFirst({
      where: { id, userId, revokedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
  }
}
