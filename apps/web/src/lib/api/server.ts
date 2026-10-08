import 'server-only';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { createApiClient, ApiError } from './client';
import { API_ORIGIN } from './config';
import { authCookieNames, HTTP_HEADER } from '@quizmb/contracts';
import { redirectUnauthenticated } from '../auth/recovery';

export async function serverApi() {
  const jar = await cookies();
  const name = authCookieNames(process.env.NODE_ENV === 'production').access;
  return createApiClient({
    baseUrl: API_ORIGIN,
    headers: {
      [HTTP_HEADER.COOKIE]: `${name}=${encodeURIComponent(jar.get(name)?.value ?? '')}`,
    },
  });
}
export async function loadApi<T>(path: string): Promise<T> {
  try {
    return await (await serverApi()).get<T>(path);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) notFound();
      if (error.status === 401) await redirectUnauthenticated(error.code);
    }
    throw error;
  }
}
