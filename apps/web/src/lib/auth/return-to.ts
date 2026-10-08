import { APP_LINKS } from '@/config/navigation';

export function safeReturnTo(value?: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return APP_LINKS.WORKSPACE.DASHBOARD;
  }

  try {
    const base = new URL('https://quizmb.local');
    const destination = new URL(value, base);

    if (destination.origin !== base.origin || value.includes('\\')) {
      return APP_LINKS.WORKSPACE.DASHBOARD;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return APP_LINKS.WORKSPACE.DASHBOARD;
  }
}

export function authLink(path: string, returnTo: string): string {
  const params = new URLSearchParams({ returnTo });
  return `${path}?${params.toString()}`;
}

/**
 * Request header the proxy sets with the page being rendered (path and
 * query), so server code can send a visitor back to it after renewing the
 * session or signing in. Overwritten on every request; never trusted as
 * anything but a return path (safeReturnTo still applies).
 */
export const REQUEST_PATH_HEADER = 'x-quizmb-path';

/** Query flag on the login page: the session ended and could not be renewed. */
export const SESSION_ENDED_PARAM = 'expired';
