import { NextResponse, type NextRequest } from 'next/server';
import { REQUEST_PATH_HEADER } from '@/lib/auth/return-to';
import { INDEXABLE_PATHS, isLiveDeployment } from '@/config/seo';

/**
 * Tells server components which page is being rendered, so an expired
 * session can be renewed in the browser and the visitor returned to the
 * same page. Client navigations add `_rsc` to the URL; it is not part of
 * the page address.
 */
export function proxy(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.searchParams.delete('_rsc');
  const headers = new Headers(request.headers);
  headers.set(REQUEST_PATH_HEADER, `${url.pathname}${url.search}`);
  const response = NextResponse.next({ request: { headers } });
  // Also covers authentication redirects, before page metadata is rendered.
  if (
    !isLiveDeployment() ||
    !INDEXABLE_PATHS.some((path) => path === url.pathname)
  ) {
    response.headers.set('X-Robots-Tag', 'noindex, follow');
  }
  return response;
}

export const config = {
  // Pages only: not Next.js assets or files with an extension.
  matcher: ['/((?!_next/static|_next/image|.*\\..*).*)'],
};
