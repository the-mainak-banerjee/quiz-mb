import 'server-only';
import { cookies } from 'next/headers';
import { createApiClient, ApiError } from '../api/client';
import { API_ORIGIN } from '../api/config';
import { API_ROUTES } from '../api/routes';
import { redirectUnauthenticated } from './recovery';
import { ERROR_CODE, authCookieNames, HTTP_HEADER } from '@quizmb/contracts';
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: null;
};
async function accessCookie() {
  const jar = await cookies();
  const name = authCookieNames(process.env.NODE_ENV === 'production').access;
  return { name, value: jar.get(name)?.value };
}
export async function currentUser(
  redirectExpired = true,
): Promise<CurrentUser | null> {
  const access = await accessCookie();
  if (!access.value) return null;
  // A new client per request: never retain user cookies in a shared server instance.
  const api = createApiClient({
    baseUrl: API_ORIGIN,
    headers: {
      [HTTP_HEADER.COOKIE]: `${access.name}=${encodeURIComponent(access.value)}`,
    },
  });
  try {
    return await api.get<CurrentUser>(API_ROUTES.AUTH.ME);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      // Renewed in the browser, then back to this page.
      if (error.code === ERROR_CODE.TOKEN_EXPIRED && redirectExpired)
        await redirectUnauthenticated(error.code);
      return null;
    }
    throw error;
  }
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) return redirectUnauthenticated();
  return user;
}

/**
 * When the browser should renew the session: the access token's expiry and
 * lifetime, read from its claims. Only a schedule hint for the browser; the
 * API verifies every token. Null when there is no readable token.
 */
export async function accessLifetime(): Promise<{
  expiresAt: number;
  lifetimeSeconds: number;
} | null> {
  const { value } = await accessCookie();
  const payload = value?.split('.')[1];
  if (!payload) return null;
  try {
    const { exp, iat } = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { exp?: unknown; iat?: unknown };
    if (typeof exp !== 'number' || typeof iat !== 'number' || exp <= iat)
      return null;
    return { expiresAt: exp * 1000, lifetimeSeconds: exp - iat };
  } catch {
    return null;
  }
}
