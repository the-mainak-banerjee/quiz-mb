import { randomBytes, createHash } from 'node:crypto';
import { SignJWT, jwtVerify, errors } from 'jose';
import { ApiError } from '../../http/api-error.js';
import type { AuthConfig } from './config.js';
export const hashRefresh = (token: string) =>
  createHash('sha256').update(token).digest('hex');
export const newRefresh = () => randomBytes(32).toString('base64url');
export class Tokens {
  private key: Uint8Array;
  constructor(private config: AuthConfig) {
    this.key = new TextEncoder().encode(config.AUTH_ACCESS_SECRET);
  }
  issue(userId: string, sessionId: string) {
    return new SignJWT({ sid: sessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer('quizmb-api')
      .setAudience('quizmb')
      .setIssuedAt()
      .setExpirationTime(
        Math.floor(Date.now() / 1000) + this.config.AUTH_ACCESS_TTL_SECONDS,
      )
      .sign(this.key);
  }
  async verify(token: string) {
    try {
      const { payload } = await jwtVerify(token, this.key, {
        algorithms: ['HS256'],
        issuer: 'quizmb-api',
        audience: 'quizmb',
        requiredClaims: ['sub', 'sid', 'exp', 'iat'],
      });
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.sid !== 'string' ||
        !/^[0-9a-f-]{36}$/.test(payload.sub) ||
        !/^[0-9a-f-]{36}$/.test(payload.sid)
      )
        throw new Error('Invalid identity');
      return { userId: payload.sub, sessionId: payload.sid };
    } catch (error) {
      throw new ApiError(
        401,
        error instanceof errors.JWTExpired
          ? 'TOKEN_EXPIRED'
          : 'UNAUTHENTICATED',
        'Please sign in to continue.',
      );
    }
  }
}
