import {
  createHash,
  createHmac,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { ERROR_CODE, OTP_RULES, type OtpPurpose } from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';
import { TOKEN_ISSUER } from '../../config/constants.js';

/** How long a signup or login may take to enter the emailed code. */
export const VERIFICATION_TICKET_TTL_SECONDS = 30 * 60;
/** How long after a correct reset code the new password may be set. */
export const RESET_TOKEN_TTL_SECONDS = 5 * 60;

const UUID = /^[0-9a-f-]{36}$/;

/** A uniformly random 6-digit code. */
export const newCode = () =>
  String(randomInt(0, 10 ** OTP_RULES.length)).padStart(OTP_RULES.length, '0');

/**
 * m***ak@example.com: the first and last two characters of the name, enough
 * to recognise the address without revealing it. Short names keep only the
 * first character.
 */
export function maskEmail(email: string) {
  const at = email.lastIndexOf('@');
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  const end = local.length > 4 ? local.slice(-2) : '';
  return `${local.slice(0, 1)}***${end}@${domain}`;
}

/**
 * Codes are stored only as an HMAC bound to the user and purpose, so a
 * stored hash is useless for another account or purpose, and a database
 * leak does not reveal live codes.
 */
export class CodeHasher {
  private key: Buffer;
  constructor(secret: string) {
    // A key derived for this use only, separate from token signing.
    this.key = createHash('sha256').update(`quizmb-otp:${secret}`).digest();
  }
  hash(userId: string, purpose: OtpPurpose, code: string) {
    return createHmac('sha256', this.key)
      .update(`${purpose}:${userId}:${code}`)
      .digest('hex');
  }
  matches(stored: string, candidate: string) {
    const a = Buffer.from(stored, 'hex');
    const b = Buffer.from(candidate, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

const flowExpired = () =>
  new ApiError(
    401,
    ERROR_CODE.AUTH_FLOW_EXPIRED,
    'This step has expired. Please start again.',
  );

/** Fingerprint of the current password hash; changes when it does. */
const passwordStamp = (passwordHash: string) =>
  createHash('sha256').update(passwordHash).digest('base64url').slice(0, 16);

/**
 * Signed, short-lived credentials for the steps before a session exists.
 * Each has its own audience, so neither works as the other or as an access
 * token. A reset token carries a stamp of the password it replaces, so it
 * stops working once the password changes (single use without storage).
 */
export class FlowTokens {
  private key: Uint8Array;
  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  private async sign(
    audience: string,
    userId: string,
    ttlSeconds: number,
    claims: Record<string, string> = {},
  ) {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const token = await new SignJWT(claims)
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.key);
    return { token, expiresAt };
  }

  private async check(audience: string, token: string) {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        issuer: TOKEN_ISSUER,
        audience,
        requiredClaims: ['sub', 'exp'],
      });
      if (typeof payload.sub !== 'string' || !UUID.test(payload.sub))
        throw new Error('Invalid subject');
      return payload;
    } catch {
      throw flowExpired();
    }
  }

  verificationTicket(userId: string) {
    return this.sign(
      'quizmb-verify-email',
      userId,
      VERIFICATION_TICKET_TTL_SECONDS,
    );
  }

  async verificationUser(ticket: string) {
    return (await this.check('quizmb-verify-email', ticket)).sub!;
  }

  resetToken(userId: string, passwordHash: string) {
    return this.sign('quizmb-password-reset', userId, RESET_TOKEN_TTL_SECONDS, {
      pwd: passwordStamp(passwordHash),
    });
  }

  /** The user, if the token is valid and their password is unchanged. */
  async resetUser(
    token: string,
    currentPasswordHash: (userId: string) => Promise<string | null>,
  ) {
    const payload = await this.check('quizmb-password-reset', token);
    const hash = await currentPasswordHash(payload.sub!);
    if (!hash || payload.pwd !== passwordStamp(hash)) throw flowExpired();
    return payload.sub!;
  }
}
