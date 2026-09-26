import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { createApiClient, ApiError } from '../api/client';
import { API_ORIGIN } from '../api/config';
import { API_ROUTES } from '../api/routes';
import { APP_LINKS } from '@/config/navigation';
export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: null;
};
export async function currentUser(
  redirectExpired = true,
): Promise<CurrentUser | null> {
  const jar = await cookies();
  const name =
    process.env.NODE_ENV === 'production'
      ? '__Secure-quizmb-access'
      : 'quizmb-access';
  const access = jar.get(name);
  if (!access?.value) return null;
  // A new client per request: never retain user cookies in a shared server instance.
  const api = createApiClient({
    baseUrl: API_ORIGIN,
    headers: { Cookie: `${name}=${encodeURIComponent(access.value)}` },
  });
  try {
    return await api.get<CurrentUser>(API_ROUTES.AUTH.ME);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      if (error.code === 'TOKEN_EXPIRED' && redirectExpired)
        redirect(APP_LINKS.AUTH.SESSION);
      return null;
    }
    throw error;
  }
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) redirect(APP_LINKS.AUTH.LOGIN);
  return user;
}
