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
