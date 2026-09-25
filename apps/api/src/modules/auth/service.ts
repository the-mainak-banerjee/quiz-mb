import { randomUUID } from 'node:crypto';
import type { User } from '@quizmb/database';
import { ApiError } from '../../http/api-error.js';
import type { AuthConfig } from './config.js';
import { AuthRepository } from './repository.js';
import { hashPassword, verifyPassword } from './password.js';
import { Tokens, hashRefresh, newRefresh } from './tokens.js';
export const publicUser = (user: Pick<User, 'id' | 'name' | 'email'>) => ({
  id: user.id,
  name: user.name,
  email: user.email,
});
export class AuthService {
  readonly tokens: Tokens;
  constructor(
    readonly repository: AuthRepository,
    readonly config: AuthConfig,
  ) {
    this.tokens = new Tokens(config);
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
  async signup(
    input: { name: string; email: string; password: string },
    userAgent?: string,
  ) {
    const refresh = newRefresh();
    const session = this.session(refresh, userAgent);
    const user = await this.repository.createAccount(
      {
        name: input.name,
        email: input.email,
        passwordHash: await hashPassword(input.password),
      },
      session,
    );
    if (!user)
      throw new ApiError(
        409,
        'CONFLICT',
        'An account could not be created with these details.',
      );
    return this.credentials(user, session.id, refresh, session.expiresAt);
  }
  async login(input: { email: string; password: string }, userAgent?: string) {
    const user = await this.repository.findByEmail(input.email);
    if (!(await verifyPassword(input.password, user?.passwordHash)) || !user)
      throw new ApiError(
        401,
        'UNAUTHENTICATED',
        'Email or password is incorrect.',
      );
    const refresh = newRefresh();
    const session = await this.repository.createSession(
      user.id,
      this.session(refresh, userAgent),
    );
    return this.credentials(user, session.id, refresh, session.expiresAt);
  }
  async refresh(token?: string) {
    if (!token || !/^[\w-]{43}$/.test(token))
      throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Please sign in again.');
    const next = newRefresh();
    const session = await this.repository.rotate(
      hashRefresh(token),
      hashRefresh(next),
      new Date(),
    );
    if (!session)
      throw new ApiError(401, 'INVALID_REFRESH_TOKEN', 'Please sign in again.');
    return this.credentials(session.user, session.id, next, session.expiresAt);
  }
  async authenticate(access?: string) {
    if (!access)
      throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
    const { userId, sessionId } = await this.tokens.verify(access);
    const session = await this.repository.activeSession(sessionId, userId);
    if (!session)
      throw new ApiError(401, 'UNAUTHENTICATED', 'Please sign in to continue.');
    return publicUser(session.user);
  }
  async logout(refresh?: string) {
    if (refresh) await this.repository.revokeFamily(hashRefresh(refresh));
  }
}
