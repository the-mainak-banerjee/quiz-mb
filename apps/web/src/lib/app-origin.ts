import 'server-only';

import { headers } from 'next/headers';

// Origin of the current web request, used to build shareable absolute links.
export async function getAppOrigin() {
  const requestHeaders = await headers();
  const host = requestHeaders.get('host');
  if (!host)
    throw new Error('Cannot resolve the web origin without a Host header.');
  const protocol =
    requestHeaders.get('x-forwarded-proto') ??
    (process.env.NODE_ENV === 'production' ? 'https' : 'http');
  return `${protocol}://${host}`;
}
