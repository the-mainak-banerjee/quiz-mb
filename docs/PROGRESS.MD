# Development Progress

## Current status

Phase 0, authentication, and the dashboard UI are complete. Dashboard product data is mocked; product backend features have not been started. No deployment has been performed.

This document records implementation progress, verification results, limitations, and approved scope adjustments. Project setup and usage instructions belong in the root README.

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
- Distributed rate limiting is deliberately deferred with TODO(auth-rate-limit) in the auth router. It remains a pre-public-rollout task.

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

- Web and API remain separate Vercel applications, with planned production domains `app.quizmb.com` and `api.quizmb.com`.
- Use separate development Supabase/Upstash resources; no dedicated staging/preview infrastructure is required initially.
- Redis coordination belongs in the realtime architecture from its first implementation phase.
- Live-session states include `LOBBY`, `LIVE_IDLE`, `QUESTION_ACTIVE`, `QUESTION_RESULT`, `LEADERBOARD`, and `COMPLETED`, with explicit lobby creation.
- End Quiz may close an active question immediately at server time, preserving accepted submissions and treating missing submissions as not attempted.
- `COMPLETED` is terminal competitive state; presentation is separate and recoverable for existing attendees.
- Returning attendees may reconnect when late joining is disabled. First-time entrants must already be registered and satisfy the late-join policy.
- Registration closes and quiz/question content locks when the host officially starts the quiz, not when the lobby opens.
- During an active question, participant-visible scores/ranks remain frozen at the last revealed state.
- PRD governs product behavior; API design governs contract shapes; database/realtime design governs persistence and Redis behavior; system design governs high-level architecture. More specific later designs supersede older examples unless they contradict the PRD.
- Exact scoring formulas/constants, password policy, token lifetimes, detailed rate limits, media limits, Redis TTLs, and detailed pagination limits remain intentionally deferred.

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
