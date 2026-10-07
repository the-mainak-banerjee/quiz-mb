import { randomUUID } from 'node:crypto';
import type { User } from '@quizmb/database';
import { ApiError } from '../../http/api-error.js';
import type { AuthConfig } from './config.js';
import { AuthRepository } from './repository.js';
import { hashPassword, verifyPassword } from './password.js';
import { Tokens, hashRefresh, newRefresh } from './tokens.js';
import {
  AUTH_RESULT_STATUS,
  ERROR_CODE,
  OTP_PURPOSE,
  OTP_RULES,
  type OtpPurpose,
  type VerificationChallengeDto,
} from '@quizmb/contracts';
import type { Logger } from 'pino';
import type { EmailSender } from '../../infrastructure/email.js';
import {
  existingAccountEmail,
  passwordResetEmail,
  verificationEmail,
} from './emails.js';
import { EmailBudget } from './email-budget.js';
import {
  CodeHasher,
  FlowTokens,
  maskEmail,
  newCode,
} from './one-time-codes.js';
import type { CodeCheck } from './repository.js';
export const publicUser = (user: Pick<User, 'id' | 'name' | 'email'>) => ({
  id: user.id,
  name: user.name,
  email: user.email,
});
/** Whole seconds from now until `time` (at least 1). */
const secondsUntil = (time: Date) =>
  Math.max(1, Math.ceil((time.getTime() - Date.now()) / 1000));

/** "in 45 seconds", "in 12 minutes", "in 3 hours". */
function waitText(seconds: number) {
  if (seconds < 60)
    return `in ${seconds} ${seconds === 1 ? 'second' : 'seconds'}`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60)
    return `in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.ceil(minutes / 60);
  return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** What a refused code means for the API response. */
function codeRefusal(check: Exclude<CodeCheck, { ok: true }>) {
  if (check.reason === 'locked') {
    const wait = secondsUntil(check.retryAt);
    return new ApiError(
      429,
      ERROR_CODE.RATE_LIMITED,
      `Too many incorrect codes. Try again ${waitText(wait)}.`,
      { retryAfterSeconds: String(wait) },
    );
  }
  if (check.reason === 'wrong')
    return new ApiError(
      422,
      ERROR_CODE.INVALID_CODE,
      'That code is incorrect.',
      {
        attemptsLeft: String(check.attemptsLeft),
      },
    );
  return new ApiError(
    410,
    ERROR_CODE.CODE_EXPIRED,
    'This code has expired or can no longer be used. Request a new code.',
  );
}

const flowExpired = () =>
  new ApiError(
    401,
    ERROR_CODE.AUTH_FLOW_EXPIRED,
    'This step has expired. Please start again.',
  );

const inSeconds = (seconds: number) => new Date(Date.now() + seconds * 1000);

/** Midnight UTC tomorrow, when the daily email budget starts again. */
const nextUtcDay = () => {
  const now = new Date();
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
};

export type AuthMailOptions = {
  /** Shown in emails as the address people can write to. */
  supportEmail?: string | undefined;
  logger?: Pick<Logger, 'error' | 'warn'> | undefined;
  /** The provider's daily allowance; without it no budget is enforced. */
  dailyEmailLimit?: number | undefined;
};

/**
 * What a code request delivers: the code itself, a notice that the address
 * already has an account (signup, so it never reveals that), or nothing (a
 * resend for that existing account, answered like any other).
 */
type Delivery = 'code' | 'notice' | 'none';
type SendOptions = {
  /** First verification code and password reset pass the 90% budget limit. */
  essential: boolean;
  delivery?: Delivery;
};
type SendResult =
  | { sent: true; resendAvailableAt: Date }
  | {
      sent: false;
      reason: 'cooldown' | 'limit' | 'budget';
      resendAvailableAt: Date;
    };

export class AuthService {
  readonly tokens: Tokens;
  private flow: FlowTokens;
  private codes: CodeHasher;
  private budget: EmailBudget | undefined;
  constructor(
    readonly repository: AuthRepository,
    readonly config: AuthConfig,
    private email?: EmailSender,
    private mail: AuthMailOptions = {},
  ) {
    this.tokens = new Tokens(config);
    this.flow = new FlowTokens(config.AUTH_ACCESS_SECRET);
    this.codes = new CodeHasher(config.AUTH_ACCESS_SECRET);
    this.budget = mail.dailyEmailLimit
      ? new EmailBudget(repository, mail.dailyEmailLimit, mail.logger)
      : undefined;
  }

  /**
   * Issues a new code (replacing, and so deleting, the previous one) and
   * delivers it, unless a limit refuses: the per-address send limits (5 per
   * hour, 10 per 24 hours, per purpose), the daily email budget for
   * non-essential sends, or the resend cooldown. Every send is recorded for
   * those limits.
   */
  private async sendCode(
    user: Pick<User, 'id' | 'name' | 'email'>,
    purpose: OtpPurpose,
    { essential, delivery = 'code' }: SendOptions,
  ): Promise<SendResult> {
    if (!this.email) throw new Error('Email delivery is not configured');
    const limitedUntil = await this.repository.sendAllowedAt(user.id, purpose);
    if (limitedUntil)
      return { sent: false, reason: 'limit', resendAvailableAt: limitedUntil };
    if (
      delivery !== 'none' &&
      this.budget &&
      !(await this.budget.allows(essential))
    )
      return { sent: false, reason: 'budget', resendAvailableAt: nextUtcDay() };
    const code = newCode();
    const blockedUntil = await this.repository.issueCode(
      user.id,
      purpose,
      this.codes.hash(user.id, purpose, code),
      inSeconds(OTP_RULES.ttlSeconds),
    );
    if (blockedUntil)
      return {
        sent: false,
        reason: 'cooldown',
        resendAvailableAt: blockedUntil,
      };
    const content = {
      name: user.name,
      code,
      supportEmail: this.mail.supportEmail,
    };
    if (delivery === 'code')
      await this.email.send(
        purpose === OTP_PURPOSE.EMAIL_VERIFICATION
          ? verificationEmail(user.email, content)
          : passwordResetEmail(user.email, content),
      );
    else if (delivery === 'notice')
      await this.email.send(
        existingAccountEmail(user.email, {
          name: user.name,
          supportEmail: this.mail.supportEmail,
        }),
      );
    // Recorded for silent deliveries too, so an existing account's
    // verification step meets the same limits as a new one.
    await this.repository.recordSend(user.id, purpose);
    return {
      sent: true,
      resendAvailableAt: inSeconds(OTP_RULES.resendCooldownSeconds),
    };
  }

  /**
   * The verification step after signup or login. Sends a code if due; for
   * an address that already has a verified account (signup only), sends a
   * notice instead and returns the same step, which can never sign in.
   */
  private async verificationChallenge(
    user: Pick<User, 'id' | 'name' | 'email'>,
    options: SendOptions,
  ) {
    let resendAvailableAt = new Date();
    try {
      ({ resendAvailableAt } = await this.sendCode(
        user,
        OTP_PURPOSE.EMAIL_VERIFICATION,
        options,
      ));
    } catch (error) {
      // The account exists either way; the person can resend from the
      // Verify Email screen once delivery works again.
      this.mail.logger?.error(
        { err: error },
        'Verification email could not be sent',
      );
    }
    const { token } = await this.flow.verificationTicket(user.id);
    const verification: VerificationChallengeDto = {
      ticket: token,
      email: maskEmail(user.email),
      expiresAt: inSeconds(OTP_RULES.ttlSeconds).toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
    };
    return {
      status: AUTH_RESULT_STATUS.VERIFICATION_REQUIRED,
      verification,
    } as const;
  }
  private session(refresh: string, userAgent?: string) {
    const id = randomUUID();
    return {
      id,
      familyId: id,
      refreshTokenHash: hashRefresh(refresh),
      expiresAt: new Date(
        Date.now() + this.config.AUTH_SESSION_TTL_SECONDS * 1000,
      ),
      userAgent: userAgent?.slice(0, 512) ?? null,
    };
  }
  private async credentials(
    user: User,
    sessionId: string,
    refresh: string,
    expiresAt: Date,
  ) {
    return {
      user: publicUser(user),
      access: await this.tokens.issue(user.id, sessionId),
      refresh,
      expiresAt,
    };
  }
  /**
   * Creates an unverified account and emails a verification code. The
   * answer is the same when the address already has an account, so signup
   * never reveals which addresses are registered: a verified owner is sent
   * a notice instead, and an unverified account gets a fresh code. The
   * existing account's name and password are never changed (that would let
   * whoever signed up second take over an account the inbox owner verifies).
   */
  async signup(input: { name: string; email: string; password: string }) {
    const user = await this.repository.createUnverified({
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(input.password),
    });
    if (user) return this.verificationChallenge(user, { essential: true });
    const existing = await this.repository.findByEmail(input.email);
    if (!existing)
      // Deleted between the two queries; nothing to protect any more.
      throw new ApiError(
        409,
        ERROR_CODE.CONFLICT,
        'Please try signing up again.',
      );
    return this.verificationChallenge(existing, {
      essential: false,
      delivery: existing.emailVerifiedAt ? 'notice' : 'code',
    });
  }

  /**
   * Signs in a verified account. A correct password for an unverified
   * account sends a fresh code (respecting the cooldown) instead.
   */
  async login(input: { email: string; password: string }, userAgent?: string) {
    const user = await this.repository.findByEmail(input.email);
    if (!(await verifyPassword(input.password, user?.passwordHash)) || !user)
      throw new ApiError(
        401,
        ERROR_CODE.UNAUTHENTICATED,
        'Email or password is incorrect.',
      );
    if (!user.emailVerifiedAt)
      return this.verificationChallenge(user, { essential: true });
    const refresh = newRefresh();
    const session = await this.repository.createSession(
      user.id,
      this.session(refresh, userAgent),
    );
    return {
      status: AUTH_RESULT_STATUS.AUTHENTICATED,
      credentials: await this.credentials(
        user,
        session.id,
        refresh,
        session.expiresAt,
      ),
    } as const;
  }

  /** Accepts the emailed code: verifies the email and starts a session. */
  async verifyEmail(ticket: string, code: string, userAgent?: string) {
    const userId = await this.flow.verificationUser(ticket);
    const check = await this.repository.checkCode(
      userId,
      OTP_PURPOSE.EMAIL_VERIFICATION,
      this.codes.hash(userId, OTP_PURPOSE.EMAIL_VERIFICATION, code),
      this.codes,
    );
    if (!check.ok) throw codeRefusal(check);
    const refresh = newRefresh();
    const session = await this.repository.verifyAndSignIn(
      userId,
      this.session(refresh, userAgent),
    );
    // Already verified: a step shown by signup for an existing account.
    if (!session) throw codeRefusal({ ok: false, reason: 'missing' });
    return this.credentials(
      session.user,
      session.id,
      refresh,
      session.expiresAt,
    );
  }

  /**
   * Sends a new verification code when the limits allow it. For the step
   * signup shows for an existing verified account, nothing is sent but the
   * answer (and the limits) are the same.
   */
  async resendVerification(ticket: string) {
    const userId = await this.flow.verificationUser(ticket);
    const user = await this.repository.findById(userId);
    if (!user) throw flowExpired();
    const result = await this.sendCode(user, OTP_PURPOSE.EMAIL_VERIFICATION, {
      essential: false,
      delivery: user.emailVerifiedAt ? 'none' : 'code',
    });
    const { resendAvailableAt } = result;
    if (!result.sent) {
      const wait = secondsUntil(resendAvailableAt);
      throw new ApiError(
        429,
        ERROR_CODE.RESEND_COOLDOWN,
        result.reason === 'cooldown'
          ? `Please wait ${wait} seconds before requesting a new code.`
          : result.reason === 'limit'
            ? `You've asked for several codes. You can request another ${waitText(wait)}.`
            : "We can't send more codes right now. Please try again later.",
        { retryAfterSeconds: String(wait) },
      );
    }
    const verification: VerificationChallengeDto = {
      ticket,
      email: maskEmail(user.email),
      expiresAt: inSeconds(OTP_RULES.ttlSeconds).toISOString(),
      resendAvailableAt: resendAvailableAt.toISOString(),
    };
    return verification;
  }

  /**
   * Starts a password reset. The answer is the same whether or not the
   * email has an account, and the code is sent in the background so the
   * response time does not reveal it either.
   */
  requestPasswordReset(email: string) {
    void this.repository
      .findByEmail(email)
      .then((user) =>
        user
          ? this.sendCode(user, OTP_PURPOSE.PASSWORD_RESET, {
              essential: true,
            })
          : null,
      )
      .catch((error: unknown) =>
        this.mail.logger?.error(
          { err: error },
          'Password reset email could not be sent',
        ),
      );
    return {
      resendAvailableAt: inSeconds(
        OTP_RULES.resendCooldownSeconds,
      ).toISOString(),
    };
  }

  /** Exchanges a correct reset code for a short-lived reset token. */
  async verifyResetCode(email: string, code: string) {
    const user = await this.repository.findByEmail(email);
    // An unknown email is answered like a missing code.
    if (!user) throw codeRefusal({ ok: false, reason: 'missing' });
    const check = await this.repository.checkCode(
      user.id,
      OTP_PURPOSE.PASSWORD_RESET,
      this.codes.hash(user.id, OTP_PURPOSE.PASSWORD_RESET, code),
      this.codes,
    );
    if (!check.ok) throw codeRefusal(check);
    const { token, expiresAt } = await this.flow.resetToken(
      user.id,
      user.passwordHash,
    );
    return { resetToken: token, expiresAt: expiresAt.toISOString() };
  }

  /** Sets the new password and signs out every session. */
  async completePasswordReset(resetToken: string, password: string) {
    const userId = await this.flow.resetUser(resetToken, async (id) => {
      const user = await this.repository.findById(id);
      return user?.passwordHash ?? null;
    });
    // The current password is accepted on purpose: refusing only that one
    // would confirm it to whoever holds the reset token.
    await this.repository.resetPassword(userId, await hashPassword(password));
  }

  async refresh(token?: string) {
    if (!token || !/^[\w-]{43}$/.test(token))
      throw new ApiError(
        401,
        ERROR_CODE.INVALID_REFRESH_TOKEN,
        'Please sign in again.',
      );
    const next = newRefresh();
    const session = await this.repository.rotate(
      hashRefresh(token),
      hashRefresh(next),
      new Date(),
    );
    if (!session)
      throw new ApiError(
        401,
        ERROR_CODE.INVALID_REFRESH_TOKEN,
        'Please sign in again.',
      );
    return this.credentials(session.user, session.id, next, session.expiresAt);
  }
  async authenticate(access?: string) {
    if (!access)
      throw new ApiError(
        401,
        ERROR_CODE.UNAUTHENTICATED,
        'Please sign in to continue.',
      );
    const { userId, sessionId } = await this.tokens.verify(access);
    const session = await this.repository.activeSession(sessionId, userId);
    // Sessions start only after verification; checked again for safety.
    if (!session?.user.emailVerifiedAt)
      throw new ApiError(
        401,
        ERROR_CODE.UNAUTHENTICATED,
        'Please sign in to continue.',
      );
    return publicUser(session.user);
  }
  async logout(refresh?: string) {
    if (refresh) await this.repository.revokeFamily(hashRefresh(refresh));
  }
}
