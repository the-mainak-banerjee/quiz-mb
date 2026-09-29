import { SignJWT, jwtVerify } from 'jose';
import { ApiError } from '../../http/api-error.js';

export const SOCKET_TICKET_TTL_SECONDS = 60;
const AUDIENCE = 'quizmb-socket';
const ISSUER = 'quizmb-api';
const UUID = /^[0-9a-f-]{36}$/;

/**
 * Single-purpose credential for the Socket.IO handshake. The web and API run
 * on different sites, so sockets cannot rely on cookies (API_DESIGN §17). A
 * distinct audience stops tickets being used as REST access tokens and vice
 * versa.
 */
export class SocketTickets {
  private key: Uint8Array;
  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  async issue(userId: string, liveSessionId: string, now = Date.now()) {
    const expiresAt = new Date(now + SOCKET_TICKET_TTL_SECONDS * 1000);
    const ticket = await new SignJWT({ lsid: liveSessionId })
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setSubject(userId)
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setIssuedAt(Math.floor(now / 1000))
      .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
      .sign(this.key);
    return { ticket, expiresAt: expiresAt.toISOString() };
  }

  async verify(ticket: unknown) {
    try {
      if (typeof ticket !== 'string' || ticket.length > 2048)
        throw new Error('Missing ticket');
      const { payload } = await jwtVerify(ticket, this.key, {
        algorithms: ['HS256'],
        issuer: ISSUER,
        audience: AUDIENCE,
        requiredClaims: ['sub', 'lsid', 'exp', 'iat'],
      });
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.lsid !== 'string' ||
        !UUID.test(payload.sub) ||
        !UUID.test(payload.lsid)
      )
        throw new Error('Invalid ticket');
      return { userId: payload.sub, liveSessionId: payload.lsid };
    } catch {
      throw new ApiError(
        401,
        'UNAUTHENTICATED',
        'Your live connection could not be verified. Please rejoin.',
      );
    }
  }
}
