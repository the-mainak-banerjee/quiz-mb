import 'server-only';
import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { createApiClient, ApiError } from './client';
import { API_ORIGIN } from './config';

export async function serverApi() {
  const jar = await cookies();
  const name =
    process.env.NODE_ENV === 'production'
      ? '__Secure-quizmb-access'
      : 'quizmb-access';
  return createApiClient({
    baseUrl: API_ORIGIN,
    headers: {
      Cookie: `${name}=${encodeURIComponent(jar.get(name)?.value ?? '')}`,
    },
  });
}
export async function loadApi<T>(path: string): Promise<T> {
  try {
    return await (await serverApi()).get<T>(path);
  } catch (error) {
    if (error instanceof ApiError) {
      if (error.status === 404) notFound();
      if (error.status === 401)
        redirect(error.code === 'TOKEN_EXPIRED' ? '/session' : '/login');
    }
    throw error;
  }
}
