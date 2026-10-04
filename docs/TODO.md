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

Fix direction: pass the ISO `plannedStartAt` to the client and format it in the browser, for example with a small client component, keeping the server-rendered markup hydration-safe.

## Database rule requiring `plannedStartAt` on non-draft quizzes

Publishing without a planned date/time is currently blocked by the quiz service, the locked publish transaction, and the request contract, but the database itself has no constraint. Add a migration so the database also rejects it:

```sql
ALTER TABLE "quizzes" ADD CONSTRAINT "quiz_planned_start_required"
  CHECK ("status" = 'DRAFT' OR "plannedStartAt" IS NOT NULL);
```

Before applying, confirm that no existing non-draft development rows have a null `plannedStartAt`, and extend the publishing integration test to assert the constraint.

## Make question Markdown production ready

Question prompts are written in Markdown, but its behaviour is not production ready yet. Review and finish it before release:

- Consistent rendering everywhere a prompt appears: the builder preview and the participant live screen render Markdown (`components/markdown-preview.tsx`), while the host console (question queue, preview and live question) and the review screen still show the raw text.
- Decide the supported syntax (headings, lists, code, links, images are currently disallowed) and how large elements such as headings look inside a prompt on each screen and on phones.
- Confirm sanitization and link handling are safe for participant-facing content, and that long or complex prompts stay readable.
- Improve the editor experience (toolbar, preview, character limits) as needed.

## Ui Issues
- The image upload should be on even before saving the quiz basis
- After saving a question it should scroll up to top
- In the live question screen fix the layout of the header and buttons after all question asked
- 0 did not answer - If it is 0 we don't need to show this text
- We need to add tabular nums in timing section
- The completed view quiz page The input fields in question details don't look like they are disabled make them look like disabled same as Basic details input

## Phase 11 — Segment 1: frontend for quiz content and capacity rules

The API now fixes questions once the lobby opens (`409 QUIZ_LOCKED`), keeps at least one question on a published quiz (`422`, `questions` field) and refuses a registration limit below the current registrations (`422`, `registrationLimit` field). The web app does not reflect this yet:

- A quiz with an open lobby (status `LOBBY`) still opens in the normal editor; saving a question only shows the error. Show its questions read only (like the completed `/view` page) while quiz details stay editable, and explain that questions are fixed once the lobby is open.
- On a published quiz, disable or explain deleting the last question instead of relying on the error.
- Optionally show the current registration count next to the limit field when editing a published quiz.

## Phase 11 — Segment 2: frontend checks for live edge cases

The API now has tests for these cases (`apps/api/tests/live-edge-cases.integration.test.ts`); their screens have not been checked:

- Host "Quiz completed" screen when nobody joined (0 participants, empty final Top 10, no podium) and when the quiz ended before any question was asked (0 asked, everyone tied at rank 1 with 0 points).
- Participant final result when nothing was asked (all counts 0): the outcome bar and tiles should not look broken.
- Ending during a question sends participants straight to their final result (no reveal of that last question); confirm this reads well.

## Phase 11 — Segment 3: frontend for host presence

Participant snapshots now carry `hostConnected`, and participants receive `session:host-presence` (`LiveHostPresenceDto { hostConnected }`) when the host has been disconnected for more than 5 seconds and again when the host returns. The web app ignores both:

- In `use-live-session.ts`, keep `hostConnected` from every participant snapshot and update it from `LIVE_EVENTS.hostPresence`.
- Show a calm, non-blocking "The host is reconnecting…" notice on participant screens while `hostConnected` is false. The quiz keeps running: an active question can still be answered and its timer still ends on time; only the host can move the quiz on.
- A host who has not connected since the API started (for example after a restart) also reads as away until they rejoin.

## Phase 11 — Segment 4: frontend for rate limits

The API now answers `429 RATE_LIMITED` with a `Retry-After` header (seconds) on login, signup, refresh, registration, upload requests, opening a lobby and socket tickets, and socket commands over their budget get a `RATE_LIMITED` acknowledgement. The web app shows only the generic message:

- Login and signup: show "Too many attempts. Try again in N minutes." using `Retry-After`, and keep the form usable afterwards.
- Refresh: a `429` on `/auth/refresh` must not sign the user out; retry after the wait instead of treating it as an expired session.
- Live room: a `RATE_LIMITED` acknowledgement should not be shown as a failure screen; retry the sync once after a short delay.
