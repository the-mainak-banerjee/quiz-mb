# Frontend API client

All frontend HTTP calls use `createApiClient`. Browser features import the single `api` instance from `@/lib/api/browser`; they do not call fetch directly. This client is for every feature, not just authentication. It adds the configured API origin, credentials, JSON headers, no-store caching, timeout/cancellation, response parsing, and consistent errors. No UI, redirects, toasts, or domain logic belong in the factory.

```ts
import { api } from '@/lib/api/browser';
import { apiError } from '@/lib/api/client';
import { API_ROUTES } from '@/lib/api/routes';

const user = await api.get<User>(API_ROUTES.AUTH.ME, {
  authenticated: true,
});
await api.patch<User>(API_ROUTES.AUTH.ME, { name }, { authenticated: true });
```

Methods: `get<T>(path, options?)`, `post<T>(path, body?, options?)`, `put<T>(path, body, options?)`, `patch<T>(path, body, options?)`, `delete<T = void>(path, options?)`. Options accept headers, an AbortSignal, and `authenticated`. Paths must stay under `/api/` on the configured origin. Responses unwrap `{ success: true, data }`; plain JSON (health) and 204 are also supported. Generic types describe the endpoint contract; they do not validate arbitrary response data at runtime.

Catch errors with `apiError(error)`. The result exposes `message`, `status`, `code`, string field `details`, and optional `requestId`. Rendering messages and deciding navigation remain feature responsibilities. Server failures, invalid JSON, network errors, timeouts, and cancellation have safe messages/codes.

An expired access token (`401 TOKEN_EXPIRED`) is always renewed once through Express and the request retried once: the API checks the token before running anything, so nothing was changed. Set `authenticated: true` for protected endpoints to also renew on any other 401. Concurrent requests share one renewal, and tabs take turns (a Web Lock plus a shared "renewed at" time), so two tabs never present the same refresh token, which the backend's strict reuse policy would treat as theft. A refused renewal (refresh token expired or revoked) sends the user to sign in with `?expired=1` and a return path. Network failures and other statuses are never automatically retried.

Session lifetime in the browser: `SessionKeeper` (signed-in pages) renews shortly before the access token expires and when a tab becomes visible again. A page the web server renders with an expired token redirects to `/session?returnTo=…`, which renews in the browser (only it receives the refresh cookie) and returns without asking. `proxy.ts` gives server code the path being rendered for that return.

Server Components create a request-scoped client using `createApiClient` and forward only the access cookie (see `lib/auth/session.ts`). Never put user cookies in a server-global client. Server clients never refresh or write cookies. Browser tokens are HttpOnly and never read by this module.

Run `pnpm --filter @quizmb/web test` for isolated client tests with mocked fetch. Node 24 runs the dependency-free TypeScript module directly.
