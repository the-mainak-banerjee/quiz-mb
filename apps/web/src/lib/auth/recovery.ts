import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { ERROR_CODE } from '@quizmb/contracts';
import { APP_LINKS } from '@/config/navigation';
import { authLink, REQUEST_PATH_HEADER, safeReturnTo } from './return-to';

/** The page being rendered (set by the proxy), for returning to it. */
export async function currentPath() {
  return safeReturnTo((await headers()).get(REQUEST_PATH_HEADER) ?? undefined);
}

/**
 * Leaves a page whose API call was refused as unauthenticated. An expired
 * access token is renewed in the browser (the refresh cookie is only sent
 * to the API) and the visitor comes straight back; anything else signs in
 * again and returns here.
 */
export async function redirectUnauthenticated(code?: string): Promise<never> {
  const path = await currentPath();
  redirect(
    authLink(
      code === ERROR_CODE.TOKEN_EXPIRED
        ? APP_LINKS.AUTH.SESSION
        : APP_LINKS.AUTH.LOGIN,
      path,
    ),
  );
}
