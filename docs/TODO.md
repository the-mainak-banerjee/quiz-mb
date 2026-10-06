# TODO

Deferred follow-up work. Each item needs approval before implementation.

## Make REST authentication work across separate web and API domains

Production will use the free platform domains with no custom domain: the web app on a `*.vercel.app` domain and the API (REST + Socket.IO) on a `*.onrender.com` domain. These are different sites, and both suffixes are on the Public Suffix List, so no cookie can be shared between them. The current auth (HttpOnly access/refresh cookies, `SameSite=Lax`, `AUTH_COOKIE_DOMAIN`, direct browser → Express requests) only works when web and API share a site, so login, protected pages and refresh will break in that deployment. Third-party cookies (`SameSite=None`) are not a reliable fix because browsers increasingly block them.

Fix direction to evaluate:

- Proxy the browser's REST calls through the web domain (for example a Vercel rewrite of `/api/*` to the Render API), so auth cookies become first-party on the web domain again. Server Components already call Express server-side with the forwarded cookie and are unaffected.
- Re-check what the proxy changes: cookie names/prefixes and `Domain`, the refresh cookie scope, `ALLOWED_ORIGINS`/CORS, the Origin/CSRF checks, forwarded client IP and request IDs, and the frontend API client base URL.
- Socket.IO cannot go through such a rewrite (no WebSocket upgrade), so it must keep connecting directly to the API domain. It already uses cookie-free ticket authentication for this reason (see API_DESIGN §17).
- Update README hosting instructions and `.env.example` files, and re-run the auth integration tests against the new setup.

## Database rule requiring `plannedStartAt` on non-draft quizzes

Publishing without a planned date/time is currently blocked by the quiz service, the locked publish transaction, and the request contract, but the database itself has no constraint. Add a migration so the database also rejects it:

```sql
ALTER TABLE "quizzes" ADD CONSTRAINT "quiz_planned_start_required"
  CHECK ("status" = 'DRAFT' OR "plannedStartAt" IS NOT NULL);
```

Before applying, confirm that no existing non-draft development rows have a null `plannedStartAt`, and extend the publishing integration test to assert the constraint.

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

## Extra Feature
