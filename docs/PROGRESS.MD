# Development Progress

## Current status

Phases 0–4 are implemented: foundation, authentication, dashboard, project/quiz authoring, and publishing/registration. Dashboards load real data, including live quizzes and history. Phase 5 (lobby and live-session foundation), Phases 6–8 (live questions, submission, scoring, personal rank and live distribution) and Phase 9 (host presentation controls and leaderboard) and Phase 10 (end quiz, final results and history) are implemented end to end. Phase 11 (reliability and hardening) is implemented except the load test, which waits for per-account project/quiz limits. Phase 12 (email verification and password reset) is implemented. No deployment has been performed.

This document records implementation progress, verification results, limitations, and approved scope adjustments. Project setup and usage instructions belong in the root README.

## Question Markdown — October 6, 2026

Branch `fix/question-markdown` (from `develop`).

- The question prompt editor is a WYSIWYG Tiptap editor (bold, italic, strikethrough, inline code, lists, quote, code block, undo/redo and keyboard shortcuts); formatting shows as you type instead of Markdown symbols. Prompts are still stored as Markdown, so existing questions and the API are unchanged.
- Every prompt display renders the formatting from the same schema: builder, review step, participant screen, host question queue, host preview and the live question. Lists use a compact two-line form. `react-markdown` was removed.
- Allowed syntax: bold, italic, strikethrough, code, lists, quotes and code blocks. Headings render as paragraphs; links, images and raw HTML are shown as plain text.
- Checks: format, lint, typecheck, web unit tests (including the new prompt Markdown tests) and build passed; the editor and host console were checked in the browser.

## Phase 12 — Email verification and password reset — October 6, 2026

Branch `phase-12-email-auth`, merged to `develop` (PR #10).

- Signup creates an unverified account and emails a 6-digit code (Resend); the session starts only after the code is accepted. Login with an unverified account sends a fresh code instead of signing in.
- Codes are HMAC-hashed, one per user and purpose (a new code replaces and deletes the old one), valid 10 minutes, 5 tries, 60-second resend cooldown; used, expired and exhausted codes are deleted. Verification and reset codes cannot be used for each other.
- Forgot password answers the same whether or not the email has an account; a correct code gives a 15-minute single-use reset token. A reset signs out every session and marks the email verified. Wording never confirms that an account exists.
- Rate limits for code checks, resends, reset requests and completions; the limits are shown on the code screens. Email templates follow the Stitch designs with the QuizMB logo inline.
- Migration `20261006000000_email_verification`; production needs `RESEND_API_KEY` and `EMAIL_FROM` (`SUPPORT_EMAIL` optional).
- Checks: format, lint, typecheck, unit tests, build and every integration test passed, including the new Phase 12 test; a real Resend send was verified.

## Phase 11 — Reliability and hardening — October 4, 2026

Branch `phase-11-hardening` (from `main` after Phase 10). In progress: the load test is deferred until email verification and per-account limits for projects and quizzes are in place.

- Content and capacity: questions are fixed once the lobby opens (details until the quiz goes live), a published quiz keeps at least one question, and the registration limit cannot drop below current registrations. Lock rules live in `@quizmb/contracts`; the editor shows them (read-only questions in the lobby, `/view` for live and completed quizzes, registration count beside the limit).
- Live edge cases are covered by `live-edge-cases.integration.test.ts`: nobody joining, ending before any question, from the result or leaderboard, or mid-question, and replaced devices.
- Presence: stale presence is cleared at startup; participants are told when the host has been away for 5 seconds and when they return (the quiz keeps running).
- Rate limits: Redis counters for login, signup, refresh, registration, uploads, lobby and socket tickets (`429 RATE_LIMITED` with `Retry-After`, fails open); per-socket in-memory budgets for live commands. `TRUST_PROXY_HOPS` sets the trusted proxy hops for the client IP.
- Registration bursts: one database call (`register_participant`, migration `20261004000000_register_participant`); 300 simultaneous registrations now all succeed in about 7 s (previously 9 of 30). `DATABASE_POOL_MAX` (default 10); saturation answers `503 SERVICE_BUSY` and the web client retries it.
- Logging of joins, reconnects, disconnects, refused commands and question lifecycle, without answer content.
- UI fixes: cover upload before the first save, empty completed screens, host console after every question is asked, disabled-looking fields on the view page, tabular timer digits.
- Checks: format, lint, typecheck, unit tests, build, and every integration test (auth, authoring, publishing, rate limit, registration burst, live sessions, live questions, live edge cases) passed.
- Remaining: load test; loading and error screens (custom design pending); mobile pass on the participant live flow.

## Phase 10 — End quiz, final results and history — October 2, 2026

Branch `phase-10-results`.

- Ending the quiz saves each participant's final score, rank and correct / incorrect / not-attempted counts in `quiz_results` (migration `20261002000000_quiz_results`), in the same transaction that completes the session. Only questions the host asked count; descriptive questions are not scored.
- Participants immediately see their own final result; the host sees totals and a private final Top 10, and can reveal it to every connected participant (`host:final-leaderboard-show`). There is no rejoining after the end.
- History page lists completed quizzes the participant registered for (including ones they missed) and opens a per-quiz summary with start and end times. The host results page shows totals and every participant ranked, 100 per page with Load more.
- Completed quizzes are read only at `/quizzes/:id/view` (the edit address redirects there); the editor shows the real status and links back to the manage page. The public quiz page shows a completed state, with View results for the host and View your result (that quiz's summary) for registered participants.
- Starting a question is now one database statement without a Redis lock (participant delivery about 1.8 s → 0.56 s at high database latency).
- Checks: format, lint, typecheck, unit tests, build, and the live questions, live sessions and publishing integration tests passed.

## Phase 9 — Host presentation controls and leaderboard — October 1, 2026

Branch `phase-9-leaderboard`. QA approved.

- Host can view the Top 10 privately (replaces the console's main area and scrolls into view), show it on every participant screen, and hide it again; participants then return to the latest question result. Asking the next question from the leaderboard hides it. Nothing advances automatically.
- Participants see the Top 10 in the same live page, with their own row highlighted and their rank and score always available (with the gap to the top 10 when outside it).
- Top 10 includes everyone ranked 10th or better, so ties at the boundary add rows; ties share a rank. Uses the existing `LEADERBOARD` session state; no migration.
- Performance: leaderboard and final question results are cached per session until the next question ends; show/hide is one conditional update; the session row loads in one query (show/hide about 2.2 s → 0.85 s at high database latency).
- Checks: format, lint, typecheck, unit tests, build, and both live integration tests (now covering the leaderboard) passed.

## Phases 6–8 — Live questions, scoring and distribution — October 1, 2026

Branch `phase-6-questions`. QA approved.

- Host asks any unused question in any order; it starts immediately with a server-owned timer. One explicit, locked submission per participant before `endsAt`; not attempted is derived. Questions close exactly once (in-process timer re-armed at boot, plus a recovery check on every interaction); ending the quiz mid-question closes it.
- Participants stay on one question card from answering through the reveal (correct answer, own answer, final distribution), then see their score and rank load in place. Late joiners get only the remaining time.
- Scoring: 1000 × (1 − 0.6 × response time ÷ duration) for correct answers, 0 otherwise; multiple answer is all-or-nothing; descriptive is not scored. Standings are computed in PostgreSQL per question (shared ranks on ties; count includes everyone who entered) instead of a Redis leaderboard, to save Upstash commands.
- Host sees live submission counts, percentages and anonymous descriptive responses, and keeps the finished question with its final results on screen until choosing the next one (Phase 9's "keep question visible", delivered early).
- Database: `AskedQuestion`, `AnswerSubmission`, `AnswerSubmissionOption` (migration `20261001000000_live_questions`). Answers cost one database statement; quiz content, answer keys and confirmed registrations are cached in memory per session.
- QA fixes: number fields ignore the scroll wheel, saving an unchanged question skips the API, question-form errors appear only after a save attempt, the Open live lobby button no longer wraps, and asking a question is faster.
- Checks: format, lint, typecheck, unit tests (26 API, 9 web), build, and both live integration tests passed against development PostgreSQL and Upstash Redis.
- Known limitations: single API instance (timers, caches and throttling are in memory); joins and reveals take a few seconds at high database latency; question Markdown needs work (docs/TODO.md).

## Phase 5 — Lobby and live-session backend — September 29, 2026

Branch `phase-5-live`. Built on the approved frontend screens, assuming the web (Vercel) and API (Render) are on different sites.

### Implemented

- Database: `LiveSessionState`, `LiveQuizSession`, `ParticipantSession`; migration `20260929000000_live_sessions` applied to development PostgreSQL with RLS. Partial unique indexes guarantee one unfinished session per host and per quiz.
- API `live-sessions` module (transport → service → repository/Redis): open lobby, current session, host's active session, 60-second socket tickets, and the `/quiz` Socket.IO namespace with join/sync/leave, start, late-join toggle and minimal end. Details in API_DESIGN "Live session implementation notes".
- Server-side rules: host-only commands; registration required to join; late join applies to first-time entrants only; returning attendees always reconnect; registration open in the lobby and closed at start; quiz content locked once live; one live quiz per host (checked in the service, the transaction and the database); the newest participant device replaces the older one; completed sessions refuse joins.
- Redis (Upstash free tier): one TLS connection with no ready check, no offline queue and bounded retries; a presence hash per session (the newest socket id per user doubles as the one-device record) and owner-checked locks. Writes happen only on join/leave and lifecycle changes; no polling, heartbeats, KEYS/SCAN or pub/sub. PostgreSQL remains the source of truth for lifecycle state.
- Web: host console `/quizzes/[quizId]/live` (lobby → live idle → ended), participant room `/quiz/[slug]/live` (lobby, live idle, reconnecting, replaced, refused, ended), conflict screen `/quizzes/[quizId]/live-conflict`, **Open live lobby / Open host console** on the manage page (the 15-minute start rule is removed), **Enter live room** on the public quiz page, and live links from dashboard and project cards. A `useLiveSession` hook fetches a fresh ticket for every (re)connect and renders only server snapshots. Live dates are formatted in the viewer's browser.
- `REDIS_URL` added to the API configuration (required in production). New dependencies: `socket.io`, `ioredis`, and `socket.io-client` (web, plus API tests).

### Checks

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (9 web + 17 API unit/foundation) and `pnpm build` passed.
- `pnpm --filter @quizmb/api test:integration` passed all 7 tests against development PostgreSQL, Upstash Redis and Storage. The new live test covers: non-owner and draft lobby refusal; concurrent lobby opens across two quizzes (exactly one wins); idempotent reopen; lobby registration; ticket refusal for unregistered users; unauthenticated and foreign-origin sockets refused; role-safe host/participant snapshots; host presence updates; host commands from participants refused; cross-session commands refused; newest-device replacement without losing presence; start broadcast; repeat start rejected; registration closed and content locked after start; late join off/on for first-time entrants versus returning attendees; reconnect restoring state; idempotent end; joins refused after end; and a new lobby allowed after ending. Test data and Redis keys are removed afterwards.
- No manual browser testing was done in this session, as agreed.

### QA fixes

- Concurrent lobby opens returned intermittent `500 INTERNAL_ERROR` (reproduced with 8 simultaneous requests across two quizzes): Prisma `P2028` ("Unable to start a transaction in the given time"), because requests queued on row locks behind the 3-connection pool beyond Prisma's 2-second default wait. Lobby opens now lock the host's user row before the quiz row, so one host's opens run one at a time and later ones see the committed session (409 `ACTIVE_SESSION_EXISTS`, or the idempotent 201 for the same quiz). All live-session and registration transactions share one `lockedTransaction` option (15-second wait) in `apps/api/src/infrastructure/transactions.ts`. The integration test now fires the 8-request race and asserts only 201/409 responses.
- The reconnect counter exceeded its maximum ("7 / 5"): Socket.IO retried indefinitely while the screen showed a fixed 5, and the manual retry continued the old run of attempts. One `MAX_RECONNECT_ATTEMPTS` (10) now drives Socket.IO, refused-handshake retries and the display. After the last attempt, participants see "We couldn't reconnect you" and the host sees a "Connection lost" banner, each with a manual retry that starts a fresh connection counting from 1.

### Known limitations

- End quiz is minimal: it completes the session and quiz without results; Phase 10 replaces it. A host cannot end a quiz from the lobby without starting it first. _(Resolved in Phase 10: ending saves final results and history.)_
- Presence has no heartbeat TTL (to save Upstash commands); if the API process crashes, stale presence can remain until the 24-hour key expiry. Presence is best effort; attendance is durable in `ParticipantSession`.
- Single API instance only: device replacement, broadcasts and registration-change events (in-process `DomainEvents`) rely on one Socket.IO server. Horizontal scaling needs the Redis adapter (and its pub/sub command cost).
- Participant lobby connected counts refresh on join and on each state change rather than continuously.
- Cross-domain REST auth is still pending (docs/TODO.md), so a deployed web app cannot yet sign in against a Render-hosted API. Socket authentication already works cross-domain.
- Rate limiting (auth, registration, uploads, live sockets) is not implemented; tracked in docs/TODO.md. _(Resolved in Phase 11.)_
- Pre-existing schema drift: the `quizzes_status_plannedStartAt_idx` index exists in migrations but not in `schema.prisma`.

## Phase 5 — Live screens, frontend only — September 29, 2026

Branch `phase-5-live`. UI built from the eight approved Stitch screens (project "QuizMB Core UI System", Host Lobby — Live Session through Host — Active Scored Question) with dummy data. No backend, API, socket, or product route was added.

### Implemented

- Development-only previews at `/dev/live` (index) and `/dev/live/[screen]`: `host-lobby`, `participant-lobby`, `participant-reconnecting`, `participant-live-idle`, `host-conflict`, `host-live-idle`, `host-descriptive`, `host-scored`. They return not-found outside development and use fixtures from `features/live-session/mock-data.ts`.
- `features/live-session/`: view-model types shaped like the API_DESIGN §22–23 host/participant snapshots; a focused live shell (brand, live badge, Exit); host lobby; three participant screens; host conflict screen inside the existing workspace shell; and one shared host console (header, three-column layout, question queue, participants/leaderboard/progress rail) reused by the idle, scored, and descriptive states.
- New shared primitives, approved for this task: `Switch`, `ProgressBar`, `Avatar`, `SegmentedControl`, `Callout`; `Badge` gained a `danger` variant and an optional `dot`. Extracted `CopyLinkButton` and switched the published-quiz management page to it. Documented in `components/ui/README.md`.
- Local-only interactions: question selection and deselection in the idle console, late-join switch, roster filter, and copy link. Unwired actions (Start quiz, Ask question, End quiz, leaderboard buttons, Try reconnecting) use the existing preview-notice pattern.

### Deliberate differences from the Stitch designs

- Content that is not in the PRD was removed or replaced, as approved: host "Lobby Ambiance" audio/photo, host checklist, seat numbers, room codes, telemetry/latency readouts, sound chimes, "SYNC v2.4", estimated run time, auto-archive, "Live Audio Backup Stream", "Encrypted WebRTC Channel", and the "Standard Accuracy (No Speed Decay)" scoring line. The lobby side card now shows real quiz settings.
- Removed "Close Early" (the PRD forbids stopping a question early), the conflict screen's "End Previous Session & Open This Lobby" and "Cancel & Keep in Draft", the host header's Console/Scores tabs, fullscreen, avatar and duplicate End button, and the duplicate "QuizMB" wordmark. True/False questions were replaced with the three supported types.
- Participant "Thinking/Writing" states (amber, not in the tokens and requiring pre-submit tracking) became Submitted vs Waiting.
- Cards use the existing `Surface` (16px radius, stone border) instead of Stitch's 12px borderless cards, for consistency with the rest of the app. Icons use lucide equivalents of the Material Symbols glyphs. Photo avatars became initials avatars. The conflict screen uses the existing workspace header/footer.
- The three host console designs differed in queue and panel styling; one shared version is used for all three states. Copy was adjusted to match PRD rules (speed-based scoring, no autoplay, answer lock, late join with remaining time).

### Responsive behaviour

- Participant screens are single-column and centred at every width. The host lobby stacks on phones and uses two columns on tablets. The host console uses three columns from 1024px, main column plus two side-by-side columns on tablets, and one column on phones in the same order on all three host consoles: live question, question list, quiz progress, leaderboard, participants. The right rail uses that same progress → leaderboard → participants order on desktop. Selecting a question on stacked layouts scrolls back to its preview and Ask button.
- Checked at 1280px (compared against the Stitch screenshots), 768px, 390px, and 320px with no horizontal page overflow on any screen; the live header was tightened to fit 320px.

### Checks

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (9 web + 14 API), and `pnpm build` passed.
- Browser checks: all eight previews rendered; question selection, switch state/name, roster filtering, and preview notices verified.

### Known limitations

- Visual only: no timers count down, no data is live, and no action is connected. Product routes, authorization, and socket wiring are left for the Phase 5 backend work.
- Stitch's own screenshot of "LIVE_IDLE — Host" is blank; that screen was built from its HTML.
- The `/dev/design-system` showcase does not yet include examples of the new primitives.

## Phase 4 — Publishing, registration, link and QR — September 29, 2026

Implemented in commit `419a5eb` (September 28); verified and cleaned up on September 29.

### Implemented

- `POST /api/quizzes/:id/publish` moves a valid `DRAFT` to `PUBLISHED` and sets `publishedAt`. It requires `plannedStartAt` and at least one question passing the shared question schema. Publishing opens registration only; it never opens a lobby or starts a session.
- Stable random `publicId` links (`/quiz/[publicId]`) backed by participant-safe `GET /api/public/quizzes/:publicId`; drafts return 404 and no answer keys are exposed. QR codes and a downloadable event poster are generated client-side from the public URL; no QR image is stored.
- Register, unregister before live start, own registration, paginated host roster, and the full host roster `GET /api/quizzes/:id/registrations/all` (kept and documented in API_DESIGN 10.5). Hosts cannot register for their own quiz; a migration cancelled any earlier host self-registrations and removed owner project associations.
- Registration re-activates cancelled rows instead of duplicating them, and creates the participant's `ProjectAssociation`, which is kept on unregister.
- Host and participant dashboard endpoints replaced dashboard fixtures on `/dashboard` and `/quizzes`; project pages load their quizzes from the project API. Participant Upcoming lists registered `PUBLISHED` quizzes by planned date.
- Web: review-and-publish panel, published-quiz management page (share link, QR, capacity, roster), public quiz landing page with logged-out/open/registered/full/closed states, and login/signup return-to-quiz redirects.
- Database: `QuizRegistration`, `ProjectAssociation`, `RegistrationStatus`, `Quiz.publishedAt`; migrations `20260928020000_publishing_registration` and `20260928030000_prevent_host_registration` applied to development PostgreSQL with RLS enabled.

### Verification of Phase 4 acceptance items — September 29

- **Publishing is blocked without a planned date/time: verified.** The service and the locked publish transaction both reject a missing `plannedStartAt` with `422 VALIDATION_ERROR` and `details.plannedStartAt`. The API contract now requires `plannedStartAt` on create/update, so it cannot be cleared before or after publishing. A new integration test sets it to `null` directly (simulating a draft saved before it was required) and confirms publishing is rejected, the quiz stays `DRAFT` with no `publishedAt`, the public link returns 404, registration returns `REGISTRATION_CLOSED`, and publishing succeeds once the date is restored. The previous test's 422 assertion was caused by the quiz having no questions, so it did not actually cover this rule.
- **Capacity holds under concurrent registrations: verified, after a fix.** Registration locks the quiz row (`FOR UPDATE`) before counting, which correctly serializes the capacity check. A new integration test fires 9 simultaneous registrations (8 participants plus one duplicate) at a 3-seat quiz: exactly 3 succeed, the rest receive `409 QUIZ_FULL` or `ALREADY_REGISTERED`, and the database and public count both show 3. Releasing one seat and racing the 5 waiting participants admits exactly one.
- **Bug found and fixed:** under that burst, requests waiting on the lock failed with `500 INTERNAL_ERROR` (Prisma `P2028`, "Unable to start a transaction in the given time") because the 3-connection pool combined with Prisma's default 2s/5s interactive-transaction limits. Capacity was never exceeded, but valid requests failed. Register/unregister transactions now wait up to 15 seconds (`capacityTransaction` in `apps/api/src/modules/registrations/repository.ts`).

### Cleanup — September 29

- Moved the dashboard `Quiz` view type to `features/dashboard/types.ts` and the publishing view types to `features/publishing/types.ts`. Product code no longer imports from `mock-data.ts`; the remaining fixtures are used only by the development-only `/dev/dashboard` preview. Removed unused publishing fixtures (`publishedQuiz`, `registeredParticipants`).
- Added one server-side `toPublishedQuizViewModel` mapper shared by the public quiz page and the management page, replacing two diverging inline mappings.
- Removed hard-coded values: the public page's `quizmb.com` share URL and the management page's `quizmb.com` host fallback (both now use `getAppOrigin()` from the request), the unused placeholder `outline` bullet list, and the per-page `hostRole`/`'You'` host fields. The management view model now carries the host's real name. Added `API_ROUTES.PUBLIC_QUIZ` for the public quiz endpoint.

### Checks

- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (9 web + 14 API unit/foundation tests), and `pnpm build` passed.
- `pnpm --filter @quizmb/api test:integration` against development PostgreSQL/Storage passed all 6 tests (auth, authoring, and the 3 publishing tests, including the new planned-date and concurrency tests). Test-owned fixtures were removed.
- HTTP smoke check against local dev servers: the management page (200) renders the request-origin share URL, title, and registered participant with no `quizmb.com` link; the public page (200) renders for anonymous and registered users with the real host name and "Quiz host" label. Smoke fixtures were removed.

### Known limitations

- Registration capacity is serialized per quiz through one row lock, and each registration makes several round trips to the remote database while holding it. Small bursts now queue successfully, but a large simultaneous burst (hundreds of participants the moment a link is shared) can still exceed the 15-second wait and return 500. A throughput-oriented approach (fewer round trips inside the lock, a larger pool, or a retryable error code) should be decided before load testing in Phase 11. _(Resolved in Phase 11: registration is one database call; 300 simultaneous registrations succeed and saturation returns a retryable `503 SERVICE_BUSY`.)_
- There is no database constraint requiring `plannedStartAt` on non-draft quizzes; the rule is enforced in the service, the publish transaction, and the request contract. A `CHECK (status = 'DRAFT' OR "plannedStartAt" IS NOT NULL)` migration would harden it if approved.
- Planned date/time strings on the public and management pages are formatted during server rendering, so they use the server's locale and time zone rather than the viewer's. In production (UTC) viewers may see a different local time than expected.
- `/registrations/all` is unpaginated; its size is bounded by the registration limit (maximum 10,000).
- The development database driver still emits the known `pg` concurrent `client.query()` deprecation warning during concurrent integration operations; results are unaffected.
- No interactive browser run was performed for this cleanup (register/unregister clicks, QR poster download); verification was by build, integration tests, and server-rendered HTML checks.

## Dashboard UI

- Implemented the approved Stitch unified host/participant dashboard at `/dashboard`, using the existing server-side auth guard. Login, signup, and session recovery now lead there; `/` is public and does not fetch a user session.
- Added reusable dashboard quiz/project cards, role indicators, navigation, empty states and mock-action feedback. Local role filtering and search operate on static fixtures. No dashboard API, model, mutation, scoring, or realtime behavior was introduced.
- Reused the existing semantic tokens, Text, Button, Input, Surface, Badge, brand and icon system. Badge accepts contextual status wording without adding a visual variant. Fixed cn() incorrectly merging semantic font sizes with text colors and added a regression test.
- Added `/dev/dashboard` to preview the same components with a fixture user; it returns not-found outside development. Product action buttons announce that the feature is not available yet.
- Verified three-column desktop, two-column tablet and single-column mobile layouts, including 390px and 320px screens without horizontal overflow. Checked role filtering, search/no-results, mobile account disclosure and preview-action feedback. Anonymous `/` returns 200; anonymous `/dashboard` redirects to `/login`.
- Frontend formatting, lint, typecheck, all 9 unit tests, and production build passed. Auth redirects were updated in code; no new account creation or database writes were needed for this UI verification.

## Authentication — September 25, 2026

### Frontend validation UX

- Login and Create Account validate fields on blur and submit, then update or clear field errors as the user edits. Invalid submissions focus the first invalid field.
- Added `noValidate` to disable native browser validation popups. Field errors use the existing FormField/Input danger state and Text messages; no form library or duplicate controls were added.
- Removed the generic highlighted-fields summary from frontend validation feedback. Specific field errors remain; login failures and network errors still use form-level messages.
- Kept changes scoped to the shared frontend auth form. Backend validation and authentication behavior remain unchanged.
- Verification: frontend lint, typecheck, and auth-form formatting passed. No end-to-end tests were run for this UX change.

### Current transport: direct browser to Express

Supersedes the original BFF transport notes below, following the user's approval:

- Removed the Next.js auth forwarding route, auth transport helper, and refresh proxy. Browser login/logout/refresh go directly to Express. Server Components continue validating the access credential with Express before rendering protected pages.
- Added the global frontend API factory in `apps/web/src/lib/api/client.ts` and browser instance in `browser.ts`. Every existing frontend API call uses it. GET/POST/PUT/PATCH/DELETE, JSON success unwrapping, field errors/request IDs, network errors, timeout/cancellation, origin confinement and optional authenticated refresh/retry are centralized. Usage is documented in the adjacent README. No dependencies were added.
- Production requires `AUTH_COOKIE_DOMAIN=quizmb.com`: the HttpOnly Secure access cookie is shared across trusted subdomains using `__Secure-`; the refresh cookie remains API-host-only using `__Host-`. Localhost uses unprefixed cookies without a Domain. Exact-origin CORS, credentials and CSRF checks remain enforced by Express.
- An expired access JWT remains in its cookie until session expiry solely to let a server-rendered page offer `/session`. It never authorizes expired access. Continue session is an explicit direct-to-Express mutation; no useEffect fetches, browser token storage, Next.js cookie mutation or domain schema changes. Browser authenticated API requests can renew/retry once; cross-tab strict replay behavior remains unchanged.
- Removed obsolete API_INTERNAL_URL/WEB_ORIGIN configuration and the BFF-specific end-to-end test. Existing production BFF cookies require a new login when switching. Production web/API must share the trusted site; unrelated Vercel preview domains are unsupported with this cookie policy.
- Focused verification passed: 8 API-client unit tests, 11 API cookie/CORS/CSRF/auth/foundation tests, changed-file formatting, lint, typecheck and production builds. No end-to-end or database integration tests were run for this refactor, as requested. Original integration results below belong to the earlier auth implementation.

Implemented only account signup, login, refresh, logout, current-user retrieval, and name updates. Signup activates accounts immediately without verification. Login/signup use the approved Stitch layout and existing semantic design primitives; forgot-password, terms, and privacy links remain dummy links. The existing foundation landing page is server-protected and displays the signed-in user with logout. No dashboard or other product feature was added.

### Decisions and security

- Express owns authentication; thin Next.js transport endpoints keep browser cookies host-only on the web origin. Server Components validate the user before rendering, with cookie renewal at the routing boundary. No useEffect bootstrapping or browser token storage.
- Argon2id passwords; approved policy is 15–128 Unicode characters, spaces allowed, no composition requirement.
- Access JWT defaults to 15 minutes; absolute refresh-session lifetime defaults to 30 days, both centralized in API configuration.
- Refresh tokens are random 256-bit credentials; PostgreSQL stores only SHA-256 hashes. Family-root row locks serialize refresh, logout, and replay revocation.
- Reuse revokes the family. Concurrent requests across different web instances may force re-login, as approved. A short-lived per-process coalescing cache reduces duplicate refresh requests within one web instance.
- Production cookies are HttpOnly, Secure, SameSite=Lax, Path=/ with __Host- names and no Domain. Local HTTP uses unprefixed cookies without Secure. Origin and JSON-content checks protect unsafe requests, including login.
- Distributed rate limiting is deliberately deferred with TODO(auth-rate-limit) in the auth router. It remains a pre-public-rollout task. _(Resolved in Phase 11: Redis rate limits; the TODO is removed.)_

### Database and dependencies

- Added only User and AuthSession, unique normalized emails, indexed token hashes/session families, timestamps, and cascading user-session ownership.
- Created and applied migration 20260925000000_auth to the development Supabase database. RLS is enabled for both tables without public policies. No seed or unrelated models.
- Local API uses the development Session pooler. Runtime TLS verifies the server certificate using the official Supabase CA supplied through ignored local environment configuration. Production Vercel runtime should use its configured transaction pooler; migration tooling uses the Session pooler.
- Added argon2, jose, cookie, Prisma client/pg adapter, pg and its types, and server-only. Database is now an API workspace dependency. No Supabase Auth, Redis, UI library, or client state library.

### Verification

- Final `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` passed. Changed-file Prettier check passed. Fixed a Windows Prisma generation race by ordering database typechecking after its build.
- Database integration test passed: signup, uniqueness, generic invalid-login errors, profile boundaries, refresh rotation/replay, concurrent refresh, logout races, independent families, expiry, and RLS. Unique test accounts were removed by cleanup.
- Web transport integration test passed against local servers: CSRF rejection, signup cookies, protected HTML, signed-in login redirect, expired-access renewal, logout and revoked-session rejection.
- Production cookie attributes and clearing are covered by an HTTP test. Unit/foundation suite: 10 passed; the two environment-dependent suites are skipped in the default command and were run explicitly.
- Browser checks covered desktop and mobile login/signup, no horizontal overflow, loading state and accessible invalid-login feedback. No production deployment or multi-instance load test was performed.
- Root format check flags existing formatting in AGENTS.md, .agents/skills/frontend-design/SKILL.md and references/design/DESIGN.md; those unrelated files were left unchanged.

### Main changed paths

- apps/api/src/modules/auth/*, modules/users/service.ts, HTTP CSRF/errors, application wiring, startup and logging; authentication tests and test typecheck config.
- apps/web/src/features/auth/*, lib/auth/*, proxy.ts, app/api/auth/[action]/route.ts, login/signup pages, root page/layout and components/brand.tsx.
- packages/database schema, auth migration, runtime factory, package exports and TypeScript/Prisma configuration.
- Workspace/package manifests, lockfile, Turbo generation ordering, ignored generated output, environment examples and README setup instructions. Local secrets remain ignored. Next.js also generated its app-local AGENTS.md and CLAUDE.md guidance files.

The Phase 0 notes below are historical. Password policy and development token defaults are now resolved as recorded above; other deferred product decisions remain unchanged.

## Phase 0 — Foundation

Completed on September 24, 2026.

### Workspace and tooling

- Created the pnpm workspace with separate web/API applications and shared configuration/database packages.
- Configured Turborepo development, build, lint, typecheck, and test tasks.
- Added strict TypeScript, shared ESLint configuration, Prettier, import-boundary rules, and Git ignore rules.
- Pinned pnpm 10.30.3 and direct dependency versions, targeted Node.js 24, and generated the workspace lockfile.

### Web application

- Created the Next.js App Router application with Tailwind CSS.
- Added the foundation homepage, layout/navigation, error boundary, and not-found page.
- Added explicitly nonfunctional login/signup placeholder pages.
- Added public API-origin environment validation and an environment example.

There are no authentication forms, protected routes, accounts, or quiz features.

### API application

- Created the Express application with separate app construction, Vercel export, and local startup.
- Added the health endpoint at `GET /api/health`.
- Added explicit CORS configuration, server-generated request IDs, structured Pino logging, safe centralized errors, and unknown-route handling.
- Added environment validation and an environment example.
- Added five foundation tests covering configuration validation, health, CORS, request IDs, missing routes, and safe error responses.

The API contains no domain modules or business endpoints. CORS credentials are disabled; authentication is deferred.

### Database tooling

- Added Prisma datasource/configuration and a development environment example.
- Added `check-connection.sql`, invoked through `pnpm db:check`.
- The probe executes `SELECT 1` in a read-only transaction and rolls back.

There are no domain models, generated runtime Prisma client, migrations, seeds, or database queries from either application.

### Setup and deployment configuration

- Documented local setup, environment boundaries, commands, database verification, and separate Vercel app configuration.
- Configured local web/API ports as `3000` and `4000`.
- Preserved the four existing design documents and their staged changes.
- Did not deploy or create dedicated staging/preview infrastructure.

### Verification results

Recorded during Phase 0 implementation:

- Formatting: **PASS**.
- Lint: **PASS**, with no lint warnings.
- Typechecking: **PASS**.
- Foundation tests: **PASS — 5 tests**.
- API production build: **PASS**.
- Web production build: **PASS**.
- Web homepage, `/login`, and `/signup` on `localhost:3000`: **HTTP 200**, with browser verification of placeholder content and no forms.
- API health on `localhost:4000`: **HTTP 200**, returning `{"status":"ok"}`.
- Request ID and allowed-origin CORS response header: **verified**.
- Database connectivity: **NOT RUN — development credentials were unavailable**.
- Vercel deployment: **NOT RUN — deployment was excluded from scope**.

Local verification servers were stopped afterward. These results describe the implementation verification run; subsequent documentation edits do not constitute a new test/build run.

### Issues resolved during implementation

- Fixed malformed CORS origins throwing a raw URL error instead of the intended configuration validation error.
- Removed two lint warnings in web configuration exports.

### Known tooling limitations

- ESLint 9.39.5 is pinned for compatibility with the Next.js lint configuration's transitive plugins. Installation emits an upstream deprecation warning. ESLint 10 was evaluated but rejected by strict peer dependency checks; those checks remain enabled.
- The system Node version during implementation was 22.22.0. Application checks used a temporary Node 24.21.0 runtime. The project targets Node 24; the system installation was not changed.
- Windows sandbox restrictions required elevated access for dependency installation and some validation commands.

### Scope adjustments

- Explicit Phase 0 approval superseded the older PRD references to authentication, protected routes, product migrations, and seeds in the foundation phase.
- Added `apps/api/src/server.ts` to separate local startup from the Vercel export, as announced before implementation.
- No functionality outside the approved Phase 0 scope was added.

## Deferred work

Phase 1 and later work requires separate authorization. The following remain unimplemented:

- Authentication, password hashing, tokens, and protected routes.
- Domain models, product migrations, and seeds.
- Projects, quizzes, questions, registrations, scoring, results, and business APIs.
- Redis coordination, Socket.IO, and live-session behavior.
- Supabase Storage uploads and QR generation.
- Shared business validation/types packages, client data/state libraries, form libraries, and UI component libraries.

## Approved architecture clarifications

These decisions were approved before implementation and remain guidance for later phases:

- Web and API remain separate applications. Updated September 29, 2026: the web app deploys to Vercel and the API (REST + Socket.IO, a long-running Node process) to Render, both on their free platform domains with no custom domain. Socket.IO cannot run on Vercel functions. **All new work must assume the web and API are on different sites:** never rely on cookies being shared between them, and authenticate Socket.IO with a short-lived ticket rather than cookies (API_DESIGN §17). Making the existing cookie-based REST auth work across the two domains is tracked in `docs/TODO.md`.
- Use separate development Supabase/Upstash resources; no dedicated staging/preview infrastructure is required initially.
- Redis coordination belongs in the realtime architecture from its first implementation phase.
- Live-session states include `LOBBY`, `LIVE_IDLE`, `QUESTION_ACTIVE`, `QUESTION_RESULT`, `LEADERBOARD`, and `COMPLETED`, with explicit lobby creation.
- End Quiz may close an active question immediately at server time, preserving accepted submissions and treating missing submissions as not attempted.
- `COMPLETED` is terminal competitive state; presentation is separate and recoverable for existing attendees.
- Returning attendees may reconnect when late joining is disabled. First-time entrants must already be registered and satisfy the late-join policy.
- Registration closes and quiz/question content locks when the host officially starts the quiz, not when the lobby opens.
- During an active question, participant-visible scores/ranks remain frozen at the last revealed state.
- PRD governs product behavior; API design governs contract shapes; database/realtime design governs persistence and Redis behavior; system design governs high-level architecture. More specific later designs supersede older examples unless they contradict the PRD.
- Exact scoring formulas/constants, password policy, token lifetimes, media limits, Redis TTLs, and detailed pagination limits remain intentionally deferred. Rate limits were set in Phase 11 (`apps/api/src/config/rate-limits.ts`).

## Documentation organization

- Reworked the root README to focus on product details, architecture, setup, environment configuration, commands, and hosting instructions.
- Moved implementation status, historical verification, scope adjustments, and known limitations into this progress document.

### Shared protected workspace and dashboard empty state — 2026-09-26

- Moved `/dashboard` under `(protected)/(workspace)`. The protected layout initializes the server-validated user provider; the workspace layout owns the shared header/footer. Future live screens can use the protected group without workspace chrome.
- Kept the existing `(auth)` routes and auth feature folders unchanged in this refactor; the public home remains public.
- Added a shared current-user context with `updateUser` for successful future profile responses. No profile editor, new state library, or auth-fetching effect was added.
- Dashboard now defaults to the approved empty-state composition; populated fixtures remain at `/dev/dashboard?state=populated` in development only. Selection depends on supplied data, not a first-visit flag.
- Removed template/starter-kit and import actions. Omitted the reference's unsupported no-sign-in claim; participant accounts remain required.
- Extracted workspace header, footer, navigation item, shell, and preview actions. Existing dashboard cards use the shared preview action provider.
- Checks: frontend lint, typecheck, nine existing tests, and production build passed. Desktop/tablet/mobile empty-state presentation inspected. Profile persistence is not implemented; future profile mutations must call `updateUser` with the saved API response.

### Header overlay dismissal — 2026-09-26

- Added Radix Dialog and Dropdown Menu primitives, retaining QuizMB tokens and controls.
- Account menu and mobile drawer close on outside click and Escape; focus returns to their triggers. Mobile navigation traps focus and locks background scrolling.
- Logout accepts an optional action renderer so it participates in menu keyboard navigation while keeping existing request, pending, and error behavior. The menu stays open during logout to preserve error feedback.
- Verified outside clicks, Escape, focus restoration, mobile focus wrapping, and scroll locking in the development preview. Existing nine frontend tests pass; lint, typecheck, and production build pass.

## Project and quiz authoring — September 28, 2026

### Implemented

- Owned project creation/editing and draft quiz creation/editing. Every quiz has a required project; reassignment is rejected.
- One reusable ProjectForm for standalone and inline creation plus editing; one QuizForm and one QuestionForm for create/edit. Added this rule to the frontend-design skill.
- Protected server-loaded project lists/details, project selection/empty state, quiz basics, three question types, ordering/duplication/deletion, saved-content preview, and review screen.
- React Hook Form with shared Zod contracts, safe lazy-loaded Markdown rendering, existing semantic primitives, reusable Radix modals, accessible native select/choice/textarea primitives.
- Explicit saves only. Dirty forms warn for route changes, editor transitions, closing the project modal, and logout. Refresh/tab close uses the browser's native warning; browsers may suppress unload warnings.
- Express projects/quizzes/questions/media modules, authentication and owner checks, strict validation, transaction locks and atomic bulk question ordering. No answer keys are exposed through public endpoints.
- Prisma Project, Quiz, Question, QuestionOption, MediaAsset models and authoring migration; applied to development PostgreSQL. RLS enabled on new tables; backend remains the data authority.
- Private Supabase bucket quizmb-media created and verified: PNG/JPEG/WebP only, maximum 10 MiB. Signed browser uploads, server completion checks (type/size/signature), signed reads, and deletion guards. Credentials remain server-only local environment values.
- Shared contracts package, Storage setup script and placeholder-only environment documentation. Fixed JSON/origin middleware to support authenticated bodyless DELETE requests.

### Scope and defaults

- Publishing remains deferred to Phase 4. `plannedStartAt` is persisted only as draft metadata in the approved contract; all created quizzes remain DRAFT until publishing is implemented.
- No live sessions, Redis/Socket.IO, registration, scoring/results, autosave, project reassignment, or cohosts.
- Project names/descriptions and quiz titles follow design counters (60/240/90). Central protective authoring defaults: quiz description 4,000 characters, question prompt 10,000, option 1,000, 20 options, 200 questions, 3,600-second timers, 10,000 participant capacity. These are implementation limits, not previously specified product limits.
- Lists use cursor pagination with 25 rows. Read URLs expire after one hour; reloading the editor obtains fresh URLs. Draft write conflicts are last-saved-wins across separate browser tabs; mutations within a quiz are serialized.
- Images require an explicitly saved quiz first. Unattached/abandoned uploads are retained; an automated cleanup policy is not implemented. Removing artwork detaches it on the next explicit save. The media DELETE endpoint rejects referenced assets.
- Project artwork and project/quiz deletion UI are outside this authoring implementation. Existing dashboard fixtures and unrelated placeholder routes remain unchanged; saved drafts are available from Projects.
- nextjs-nav-guard supports the current Next.js version but depends on App Router internals; include navigation-warning regression checks when upgrading Next.js.

### Verification

- Shared validation/unit tests cover question answer-key rules, ungraded descriptive questions, forbidden lifecycle/project writes, image limits, and file signatures.
- Development integration tests cover authentication, cross-owner rejection, simultaneous question creation, reorder/delete compaction, live content locking, RLS, and private Storage upload/read/attachment/deletion. Test-owned resources are removed after each run.
- Browser checks exercise project creation, keep-editing warning, quiz draft save, question save without timer override, all three question type controls, Markdown preview, review, and navigation warnings. Desktop, tablet and narrow mobile layouts inspected; fixed step wrapping and smallest-screen header overflow.
- Final checks passed: pnpm format:check, pnpm lint, pnpm typecheck, pnpm test (9 web + 14 API unit/foundation tests), and pnpm build. Database integration tests run separately passed for authentication and authoring including real Storage. No lint warnings in changed packages. A pg driver deprecation warning appeared during concurrent integration operations; it did not affect results.
- Browser logout cancellation retained the unsaved form. Discarded route edits were verified absent in PostgreSQL. Browser QA project/quiz and integration fixtures were removed. Publishing, production deployment, and realtime behavior were not exercised.

## Authoring implementation notes — 2026-09-28

The current authoring slice implements the project list/create/read/update, project quiz list/create, host quiz read/update, question create/update/delete/reorder, and media upload-request/complete/delete routes above. Project/quiz deletion, public quiz views, and publishing remain deferred.

- Explicit-save clients submit complete editable field sets on PATCH. Strict validation rejects lifecycle writes, quiz project reassignment, and unknown fields.
- Quiz draft create/update includes nullable `plannedStartAt` as planned-date metadata only. It does not transition status. New quizzes always remain `DRAFT`; publishing must reject a missing `plannedStartAt`.
- Host quiz responses and question mutation responses return the current owned quiz with ordered questions and answer keys. They must never be reused as participant DTOs.
- Media completion returns `{ id, fileName, url }`, where `url` is a one-hour private read URL. Media deletion returns 204 and is rejected while any quiz/question references the asset.
- PNG/JPEG/WebP uploads up to 10 MiB are supported. Uploads require an existing owned, editable quiz; project covers are not part of this slice.
- List responses include `meta.nextCursor` with a page size of 25. Cursors are UUIDs interpreted as stable ascending keyset positions.
- Runtime schemas and DTOs live in `packages/contracts/src/index.ts`; centralized protective input limits are documented in PROGRESS.MD.

## Publishing and registration implementation notes — 2026-09-29

The publishing slice implements `POST /api/quizzes/:quizId/publish`, `GET /api/public/quizzes/:publicId`, the registration routes in section 10 (including the `/registrations/all` roster in 10.5), and both dashboard routes in section 11. This supersedes the "publishing remain deferred" statement in the authoring notes above.

- Publishing requires `DRAFT` status, `plannedStartAt`, and at least one question that passes the shared question schema. A missing `plannedStartAt` returns `422 VALIDATION_ERROR` with `details.plannedStartAt`; the check is repeated inside the locked publish transaction. Publishing an already published quiz returns it unchanged.
- Quiz create/update payloads now require `plannedStartAt`, so it cannot be cleared through the API; drafts saved before it became required can still hold `null` and cannot be published until it is set.
- Registration locks the quiz row (`SELECT … FOR UPDATE`) before counting `REGISTERED` rows, so concurrent requests are serialized and capacity cannot be exceeded. Waiting requests queue for up to 15 seconds instead of failing.
- Additional error codes beyond section 5: `HOST_CANNOT_REGISTER` (403, host registering for their own quiz), `REGISTRATION_CLOSED` (409, quiz not `PUBLISHED`), `UNREGISTRATION_CLOSED` (409, quiz `LIVE` or `COMPLETED`), `NOT_REGISTERED` (404 on unregister), and `QUIZ_LOCKED` (409, publishing a non-draft quiz).
- `GET /api/public/quizzes/:publicId` returns `PublicQuizDto` for `PUBLISHED`, `LOBBY`, `LIVE`, and `COMPLETED` quizzes only; drafts return 404. It never includes options or answer keys.
- `GET /api/dashboard/host` currently returns `{ projects, quizzes }` (quizzes of every status, grouped by the web client) rather than the per-status lists sketched in 11.2. `GET /api/dashboard/participant` returns `upcoming`, `live` and (since Phase 10) `history`.


## Live session implementation notes — Phase 5 — 2026-09-29

Implemented REST routes (authenticated, Origin-checked, owner/registration checks on the server):

- `POST /api/quizzes/:quizId/live-session` — host opens the lobby for a `PUBLISHED` quiz (quiz → `LOBBY`, session `LOBBY`, `allowLateJoin` copied from the quiz). Idempotent for the same quiz (returns the existing session). `409 ACTIVE_SESSION_EXISTS` with `details.liveSessionId`/`details.quizId` when the host has another unfinished session; `409 QUIZ_NOT_OPEN` for drafts; `409 QUIZ_COMPLETED`; `404` for non-owners.
- `GET /api/quizzes/:quizId/live-session` — the quiz's unfinished session as `LiveSessionRefDto { id, quizId, state, role }` for its host or a registered participant; `403 REGISTRATION_REQUIRED` otherwise; `404 SESSION_NOT_FOUND` when none is open.
- `GET /api/live-sessions/active` — the host's unfinished session (`ActiveHostSessionDto`) or `null`; drives the conflict screen.
- `POST /api/live-sessions/:liveSessionId/socket-ticket` — `{ ticket, expiresAt }` (60 seconds) for the host or a registered participant (see §17 cross-domain handshake).

Socket.IO (`/quiz` namespace) as implemented:

- Handshake: `auth.ticket` is verified before the connection is accepted; `allowRequest` also rejects WebSocket upgrades from origins outside `ALLOWED_ORIGINS` (requests without an Origin still need a ticket). Command payloads must target the ticket's live session.
- `session:join` → role-safe snapshot (`HostLiveSnapshotDto` with roster ≤ 100 and host questions including answer keys; `ParticipantLiveSnapshotDto` with neither). Participants must be registered; after the quiz starts, first-time entrants need late join enabled (`403 LATE_JOIN_DISABLED`) while returning attendees always reconnect; completed sessions return `QUIZ_COMPLETED`. The newest participant socket replaces the previous one (`session:replaced`, then a forced disconnect). The host may keep several tabs connected.
- `session:sync` (participants must still be the active device, else `SESSION_REPLACED`) and `session:leave`.
- Host-only commands with server-side host checks and a short Redis lock: `host:quiz-start` (`LOBBY → LIVE_IDLE`, quiz → `LIVE`, closes registration and locks content), `host:late-join-set`, and a minimal `host:quiz-end` (session and quiz → `COMPLETED`, idempotent; Phase 10 added final results and the final leaderboard). Invalid transitions return `INVALID_STATE_TRANSITION`; concurrent transitions `OPERATION_IN_PROGRESS`.
- Server → client: after every lifecycle change the server broadcasts a full role-safe `session:snapshot` to the host and participant rooms (instead of separate `quiz:started`/`quiz:ended` events in Phase 5). `host:presence-updated { userId, connected, connectedCount }` goes to the host room only. Participants receive `session:connected-count { connectedCount }`, throttled to at most one update per 2 seconds per session (sent in memory, no Redis commands).
- Acknowledgements use `{ ok: true, data } | { ok: false, error: { code, message } }`.
- Additional codes: `REGISTRATION_CLOSED` also applies once the quiz is `LIVE` (registration stays open in `LOBBY`), `LIVE_UNAVAILABLE` (503, Redis unreachable), `NOT_JOINED`, `OPERATION_IN_PROGRESS`.
- `GET /api/dashboard/participant` now fills `live` with registered quizzes in `LOBBY` or `LIVE`.
- `host:lobby-close` (host only, `LOBBY` state only, else `INVALID_STATE_TRANSITION`): cancels an unstarted lobby. The session and its lobby attendance are deleted, presence is cleared and the quiz returns to `PUBLISHED` with registrations kept. Other sockets in the room receive `session:removed { code: 'LOBBY_CLOSED' }` and are disconnected; the ack carries no snapshot.
- Registration changes while a session is open (registration stays open in `LOBBY`): every register/unregister pushes a fresh host `session:snapshot` (roster and counts). An unregistering participant's presence and lobby attendance are removed, and their socket receives `session:removed { code: 'REGISTRATION_REQUIRED', message }` before being disconnected. `session:sync` re-checks registration.

## Quiz status socket — 2026-09-29

Read-only lifecycle updates for the public quiz page, so registered participants see **Enter live room** (and lobby closed, started, ended) without reloading.

- `POST /api/quizzes/:quizId/watch-ticket` → `{ ticket, expiresAt }` (60 seconds) for any signed-in user and any non-draft quiz (`404` for drafts). Lifecycle status is already public, so registration is not required. Watch tickets use their own audience: they cannot join `/quiz`, and live tickets cannot watch.
- Namespace `/quiz-status`: the handshake verifies `auth.ticket`; the socket watches only the ticket's quiz, receives `quiz:status { quizId, status }` on connect and after every change. There are no client commands.
- Status changes are published in-process when a lobby opens (`LOBBY`), closes (`PUBLISHED`), the quiz starts (`LIVE`) or ends (`COMPLETED`). No Redis commands are used; like other in-process events this assumes a single API instance.


## Live questions — Phase 6 — 2026-10-01

Question delivery and submission on the `/quiz` namespace. Answer reveal (correct answer and final distribution) and the host's live answer breakdown are included now; points, score and rank remain Phase 7.

- `host:question-start { liveSessionId, questionId }` (host only, from `LIVE_IDLE` or `QUESTION_RESULT`): any unused question, in any order, starts immediately; session → `QUESTION_ACTIVE`. Creates an `AskedQuestion` (live `sequenceNumber`, `durationSeconds`, `startedAt`, `endsAt`). `QUESTION_ALREADY_ASKED` for a reused question, `INVALID_STATE_TRANSITION` while another question is active, `404` for a question from another quiz.
- `answer:submit { liveSessionId, askedQuestionId, selectedOptionIds? | answerText? }` (participants only): accepted only from the participant's active device (`SESSION_REPLACED`), while server time is before `endsAt` (`SUBMISSION_CLOSED`), once per participant (`ALREADY_SUBMITTED`) and with a valid shape (`INVALID_ANSWER`: exactly one option for single choice, one or more distinct options for multiple answer, text up to `ANSWER_LIMITS.text` for descriptive; options must belong to the question). The ack is `ParticipantAnswerDto` with `isCorrect: null` and `pointsAwarded: 0` while the question is active. Correctness is decided on the server at submission; multiple answer is all-or-nothing.
- Expiry: the server closes the question at `endsAt` (in-process timer, re-armed at boot), and any join, sync, submission or question start also closes an overdue question first. Clients sync when their countdown reaches zero. Closing is exactly-once (row lock + status check); the session → `QUESTION_RESULT`. `host:quiz-end` during a question closes it at the current server time.
- Snapshots carry `serverTime` for clock offset. Participant snapshots include `question` (participant-safe, `reveal: null` while active; `reveal { correctOptionIds, distribution, submittedCount }` after it ends). Personal fields `myAnswer` and `joinedDuringQuestion` appear only in snapshots addressed to one participant (join, sync, and the per-participant snapshot sent when a question ends); broadcasts omit them. Not attempted is derived (no row stored), shown as `myAnswer.status: 'NOT_ATTEMPTED'` after the end.
- Host snapshots include `askedQuestions` and `currentQuestion` (active or just ended, with `submittedCount`, per-option `distribution` and the newest 50 descriptive `responses` without participant identity). `host:submissions-updated` (host room only) sends the same progress at most once per second per session.
- Hot path: an answer costs one database statement (single atomic insert guarded by a shared row lock on the asked question) plus one Redis `HGET` for the active device; answer keys and confirmed registrations are cached in memory per session (single API instance).

## Scoring and personal rank — Phase 7 — 2026-10-01

- Points are decided on the server when an answer is accepted and revealed only after the question ends: a correct answer earns `1000 × (1 − 0.6 × responseTime / duration)`, rounded (about 1000 instant, 700 at half time, 400 at the deadline); incorrect, not attempted and descriptive answers earn 0; multiple answer is all-or-nothing. Constants live in `SCORING` (API live-sessions constants); not configurable in the UI.
- Standings are computed in PostgreSQL in one query when a question ends: each participant's total over completed asked questions only (an active question never changes standings), ranked with shared ranks on exact ties (1, 1, 3). `participantCount` is everyone who entered the live session, including zero scores. This replaces the Redis sorted-set leaderboard from the database design to keep Upstash command usage low; the database remains the source of truth.
- Delivery: the per-participant reveal snapshot is sent first, then `participant:standing { askedQuestionId, totalScore, rank, participantCount }` to each connected participant, so clients show the reveal while the standing loads. Personal snapshots (join, sync) include `myStanding` once the current question has ended.

## Live distribution and result screen — Phase 8 — 2026-10-01

Delivered with Phase 6: host-only live counts, percentages and descriptive responses (`host:submissions-updated`), automatic reveal at expiry with the correct answer and final distribution for participants, correct/incorrect states and the post-question waiting state. Participants receive neither the answer key, the distribution nor host progress before expiry (covered by the live questions integration test).

## Host presentation controls and leaderboard — Phase 9 — 2026-10-01

- `host:leaderboard-get` (host only): returns `LeaderboardDto { entries: [{ rank, userId, name, score }], participantCount, afterQuestionNumber }` without changing participant screens (host private view).
- `host:leaderboard-show` (host only, from `QUESTION_RESULT`): session → `LEADERBOARD`; host and participant snapshots carry `leaderboard`, and participants see the Top 10 instead of the question result, with their own rank (`myStanding`) still available. `host:leaderboard-hide` returns to `QUESTION_RESULT` with the latest result. Asking the next question from `LEADERBOARD` hides it implicitly. Showing during a question returns `INVALID_STATE_TRANSITION`.
- Top 10 lists at most `LEADERBOARD_SIZE` participants who have scored (zero-point participants are never listed, so a field of zero ties cannot turn it into the whole roster); ties share a rank and are ordered by name, and `rank` is the overall rank. `participantCount` still counts everyone who entered. Computed in PostgreSQL from the same ranking query as personal standings, so both always agree.
- Timer expiry never advances: the host keeps the finished question (or the leaderboard) on screen until choosing the next question.
- Performance: the leaderboard and the ended question's final results are cached per session until the next question ends (or someone enters for the first time; reconnects keep the cache), and concurrent host and participant snapshots share one query. Showing or hiding is a single conditional update (`state` must match), and the live session row loads in one SQL query.

## Live review fixes — 2026-10-01

- Question close timers are tracked per asked question: a late close of an earlier question never cancels the active question's timer. Failed timer closes are logged and retried; after the last retry the next interaction still closes the question.
- `answer:submit` for a question outside the caller's session returns `QUESTION_NOT_ACTIVE` before any status check, so other sessions' questions reveal nothing.
- Participant clients take the server clock offset only from `session:join` and `session:sync` replies, corrected by half the round trip; broadcasts no longer move it. `joinedDuringQuestion` and `myStanding` are applied only to the asked question they describe.
- In-process live caches are per session and dropped when the session ends, closes, or sits unused for two hours.
