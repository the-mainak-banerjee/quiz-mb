# TODO

Deferred follow-up work. Each item needs approval before implementation.

## Make REST authentication work across separate web and API domains

Production will use the free platform domains with no custom domain: the web app on a `*.vercel.app` domain and the API (REST + Socket.IO) on a `*.onrender.com` domain. These are different sites, and both suffixes are on the Public Suffix List, so no cookie can be shared between them. The current auth (HttpOnly access/refresh cookies, `SameSite=Lax`, `AUTH_COOKIE_DOMAIN`, direct browser → Express requests) only works when web and API share a site, so login, protected pages and refresh will break in that deployment. Third-party cookies (`SameSite=None`) are not a reliable fix because browsers increasingly block them.

Fix direction to evaluate:

- Proxy the browser's REST calls through the web domain (for example a Vercel rewrite of `/api/*` to the Render API), so auth cookies become first-party on the web domain again. Server Components already call Express server-side with the forwarded cookie and are unaffected.
- Re-check what the proxy changes: cookie names/prefixes and `Domain`, the refresh cookie scope, `ALLOWED_ORIGINS`/CORS, the Origin/CSRF checks, forwarded client IP and request IDs, and the frontend API client base URL.
- Socket.IO cannot go through such a rewrite (no WebSocket upgrade), so it must keep connecting directly to the API domain. It already uses cookie-free ticket authentication for this reason (see API_DESIGN §17).
- Update README hosting instructions and `.env.example` files, and re-run the auth integration tests against the new setup.

## Show planned date/time in the viewer's time zone

The planned date/time on the public quiz page (`/quiz/[publicId]`) and the published-quiz management page is formatted during server rendering in `apps/web/src/features/publishing/view-model.ts` (`toLocaleDateString`/`toLocaleTimeString` with no explicit locale or time zone). The result uses the server's locale and time zone instead of the viewer's, so production viewers (server in UTC) may see a different local time than expected. The dashboard cards in `apps/web/src/features/dashboard/quiz-data.ts` share the same pattern.

Fix direction: pass the ISO `plannedStartAt` to the client and format it in the browser. The hydration-safe `components/local-date-time.tsx` (added in Phase 10 for results and history) already does this and can be reused here.

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


## Before launch
- Add proper rate limits to prevent abuse.
- What to do for settings and workspace plan.
- Loading and error screens (`loading.tsx` / `error.tsx` for the workspace, live room and public quiz page): waiting for a custom design. Including 404 page
- Then work on the other todo items

### UI bugs
- While creating quiz after creating a project directly send them to quiz basic page
- The text area should not be expandable by user
- While we added image in quiz the save and add question is taking too much time => Still too much time
- After saving the quiz basics it is taking some time to go to the next page that time the button and everything stays active in the quiz basic page that is bad UX
- Add real screenshot in auth pages right section
- There should be a confirm password field in signup
- If from the manage page host try to start the complete quiz again then we are showing the error that this quiz is already completed. After that we can reload the page automatically.
- After the quiz end there is view full result and final leaderboard button place them below the text rather than on the right side and the View full result button is not looking good in current UI