# TODO

Deferred follow-up work. Each item needs approval before implementation.

## Make REST authentication work across separate web and API domains

Production will use the free platform domains with no custom domain: the web app on a `*.vercel.app` domain and the API (REST + Socket.IO) on a `*.onrender.com` domain. These are different sites, and both suffixes are on the Public Suffix List, so no cookie can be shared between them. The current auth (HttpOnly access/refresh cookies, `SameSite=Lax`, `AUTH_COOKIE_DOMAIN`, direct browser → Express requests) only works when web and API share a site, so login, protected pages and refresh will break in that deployment. Third-party cookies (`SameSite=None`) are not a reliable fix because browsers increasingly block them.

Fix direction to evaluate:

- Proxy the browser's REST calls through the web domain (for example a Vercel rewrite of `/api/*` to the Render API), so auth cookies become first-party on the web domain again. Server Components already call Express server-side with the forwarded cookie and are unaffected.
- Re-check what the proxy changes: cookie names/prefixes and `Domain`, the refresh cookie scope, `ALLOWED_ORIGINS`/CORS, the Origin/CSRF checks, forwarded client IP and request IDs, and the frontend API client base URL.
- Socket.IO cannot go through such a rewrite (no WebSocket upgrade), so it must keep connecting directly to the API domain. It already uses cookie-free ticket authentication for this reason (see API_DESIGN §17).
- Update README hosting instructions and `.env.example` files, and re-run the auth integration tests against the new setup.

## Add rate limiting (auth, registration, uploads and live sockets)

No rate limiting exists yet. It was deliberately deferred and must be added before public rollout. The code already marks the auth part with `TODO(auth-rate-limit)` in `apps/api/src/modules/auth/routes.ts`: "Add distributed Redis counters before public rollout for signup/login/refresh (IP + normalized account key). Intentionally deferred by product approval; no per-instance in-memory substitute."

Scope, following API_DESIGN §46 and DATABASE_REDIS_SOCKET_DESIGN §52:

- REST: `POST /api/auth/signup`, `/auth/login`, `/auth/refresh` (per IP and per normalized email/account), `POST /api/quizzes/:id/register`, `POST /api/media/upload-request`, `POST /api/quizzes/:id/live-session` and `POST /api/live-sessions/:id/socket-ticket`.
- Socket.IO: `session:join`, and later `answer:submit`, `host:question-start` and `host:quiz-end`, per user.
- Use Redis counters with TTL (`rate:{scope}:{identifier}:{window}`) so limits hold across instances; return `429 RATE_LIMITED` (REST) or a `RATE_LIMITED` acknowledgement (sockets). Do not add an in-memory per-instance fallback.
- Upstash free tier: each limited request costs at least one Redis command (`INCR` plus `EXPIRE`, or a single Lua script). Choose windows and scopes that keep monthly usage within the free quota.
- Behind Render's proxy, derive the client IP from a trusted `X-Forwarded-For` hop (configure Express `trust proxy` accordingly), never from an arbitrary header.
- Remove the `TODO(auth-rate-limit)` comment when done and add integration tests for limit, reset and `429` responses.

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
