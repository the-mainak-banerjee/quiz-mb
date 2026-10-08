# TODO

Deferred follow-up work. Each item needs approval before implementation.

## Make REST authentication work across separate web and API domains

Production will use the free platform domains with no custom domain: the web app on a `*.vercel.app` domain and the API (REST + Socket.IO) on a `*.onrender.com` domain. These are different sites, and both suffixes are on the Public Suffix List, so no cookie can be shared between them. The current auth (HttpOnly access/refresh cookies, `SameSite=Lax`, `AUTH_COOKIE_DOMAIN`, direct browser → Express requests) only works when web and API share a site, so login, protected pages and refresh will break in that deployment. Third-party cookies (`SameSite=None`) are not a reliable fix because browsers increasingly block them.

Fix direction to evaluate:

- Proxy the browser's REST calls through the web domain (for example a Vercel rewrite of `/api/*` to the Render API), so auth cookies become first-party on the web domain again. Server Components already call Express server-side with the forwarded cookie and are unaffected.
- Re-check what the proxy changes: cookie names/prefixes and `Domain`, the refresh cookie scope, `ALLOWED_ORIGINS`/CORS, the Origin/CSRF checks, forwarded client IP and request IDs, and the frontend API client base URL.
- Socket.IO cannot go through such a rewrite (no WebSocket upgrade), so it must keep connecting directly to the API domain. It already uses cookie-free ticket authentication for this reason (see API_DESIGN §17).
- Update README hosting instructions and `.env.example` files, and re-run the auth integration tests against the new setup.

## Phase 11 — still open

Done on branch `phase-11-hardening`: the rate limiting item, the Phase 10 "end during a question" item and the earlier UI issues list (all removed from this file), plus backend Segments 1–6 and their frontend work. Still open:

- Segment 7: load test of a full live quiz (target participant count to be decided). On hold.


## Load quiz relations in one query (Prisma `relationJoins`)

Every authoring response reloads the full quiz with `quizInclude` (project, cover, questions, question images, options, registration count). Prisma currently runs one database round trip per relation, so with the dev database in Seoul (~180 ms per query) a reload alone costs about 1.7–2.6 s, and it follows every question save and quiz update.

Fix direction: enable the `relationJoins` preview feature in `packages/database/prisma/schema.prisma` and use `relationLoadStrategy: 'join'` for `quizInclude` reads, so each reload is a single SQL query. Regenerate the client and re-run every integration test. Hosting the production API near the database (e.g. Render Singapore for the Seoul database) matters more and should be done regardless.

## Before launch
- Add proper rate limits to prevent abuse.
- What to do for settings and workspace plan.
- Loading and error screens (`loading.tsx` / `error.tsx` for the workspace, live room and public quiz page): waiting for a custom design. Including 404 page
- Then work on the other todo items
- Track egress (download bandwidth) usage (security design 1.5 and 1.11): image reads from Supabase Storage are not measured yet, so there is no warning before the platform's bandwidth allowance runs out. Decide how to measure it (Supabase usage, or counting signed read URLs) and add a log alert like the storage ones.

## During deployment

- Set up log alerts on Render (security design 1.11): the API writes warning lines with an `alert` field (`LIVE_COMMAND_FORBIDDEN`, `RATE_LIMITED`, `LIVE_RATE_LIMITED`, `SOCKET_FLOOD`, `QUOTA_REFUSED`, `STORAGE_HIGH`, `STORAGE_FULL`, `EMAIL_BUDGET`). Nothing notifies anyone until a log search or alert on `"alert":` is configured in Render (or a log drain). Also note the protective switch: `PAUSED_FEATURES=signup,quiz_create,upload` in Render's environment pauses those features.
