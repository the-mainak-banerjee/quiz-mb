import { SignJWT, jwtVerify } from 'jose';
import { ApiError } from '../../http/api-error.js';
import { ERROR_CODE } from '@quizmb/contracts';
import { TOKEN_ISSUER } from '../../config/constants.js';
import { TICKET_KIND } from './constants.js';

export const SOCKET_TICKET_TTL_SECONDS = 60;
const UUID = /^[0-9a-f-]{36}$/;

// Each ticket kind has its own audience and resource claim, so a live-room
// ticket cannot watch quiz status and a watch ticket cannot join a live room.
const KINDS = {
  [TICKET_KIND.LIVE]: { audience: 'quizmb-socket', claim: 'lsid' },
  [TICKET_KIND.WATCH]: { audience: 'quizmb-quiz-watch', claim: 'qid' },
} as const;
type Kind = keyof typeof KINDS;

/**
 * Single-purpose credentials for Socket.IO handshakes. The web and API run on
 * different sites, so sockets cannot rely on cookies (API_DESIGN §17). The
 * audiences also differ from REST access tokens.
 */
export class SocketTickets {
  private key: Uint8Array;
  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  private async sign(
    kind: Kind,
    userId: string,
    resourceId: string,
    now: number,
  ) {
    const { audience, claim } = KINDS[kind];
    const expiresAt = new Date(now + SOCKET_TICKET_TTL_SECONDS * 1000);
    const ticket = await new SignJWT({ [claim]: resourceId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(TOKEN_ISSUER)
      .setAudience(audience)
      .setIssuedAt(Math.floor(now / 1000))
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.key);
    return { ticket, expiresAt: expiresAt.toISOString() };
  }

  private async check(kind: Kind, ticket: unknown) {
    const { audience, claim } = KINDS[kind];
    try {
      if (typeof ticket !== 'string' || ticket.length > 2048)
        throw new Error('Missing ticket');
      const { payload } = await jwtVerify(ticket, this.key, {
        algorithms: ['HS256'],
        issuer: TOKEN_ISSUER,
        audience,
        requiredClaims: ['sub', claim, 'exp', 'iat'],
      });
      const resourceId = payload[claim];
      if (
        typeof payload.sub !== 'string' ||
        typeof resourceId !== 'string' ||
        !UUID.test(payload.sub) ||
        !UUID.test(resourceId)
      )
        throw new Error('Invalid ticket');
      return { userId: payload.sub, resourceId };
    } catch {
      throw new ApiError(
        401,
        ERROR_CODE.UNAUTHENTICATED,
        'Your live connection could not be verified. Please rejoin.',
      );
    }
  }

  /** Ticket for joining one live session (`/quiz` namespace). */
  issue(userId: string, liveSessionId: string, now = Date.now()) {
    return this.sign(TICKET_KIND.LIVE, userId, liveSessionId, now);
  }

  async verify(ticket: unknown) {
    const { userId, resourceId } = await this.check(TICKET_KIND.LIVE, ticket);
    return { userId, liveSessionId: resourceId };
  }

  /** Ticket for watching one quiz's lifecycle status (`/quiz-status`). */
  issueWatch(userId: string, quizId: string, now = Date.now()) {
    return this.sign(TICKET_KIND.WATCH, userId, quizId, now);
  }

  async verifyWatch(ticket: unknown) {
    const { userId, resourceId } = await this.check(TICKET_KIND.WATCH, ticket);
    return { userId, quizId: resourceId };
  }
}
