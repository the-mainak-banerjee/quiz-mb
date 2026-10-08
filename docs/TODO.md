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
- What to do for settings. => Done
- Handle session expire automatically => Done
- Create Home page/Landing page
- QA testing and issues fixes   
- Pages of footer => Done
- Load Test of Phase 11
- Track egress (download bandwidth) usage (security design 1.5 and 1.11): image reads from Supabase Storage are not measured yet, so there is no warning before the platform's bandwidth allowance runs out. Decide how to measure it (Supabase usage, or counting signed read URLs) and add a log alert like the storage ones.

## BE checks
- Check the cron job for unverified account deletation.

## UI QA Issues

- Add text color success whenever we are doing any success activity like password validation match text.
- Add miro in empty screens rather than icon. Like no quiezzes found
- Whenever the dropdown and modal is opening UI is shifting as there is a more place added for scrollbar
