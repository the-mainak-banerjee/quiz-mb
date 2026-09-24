# Development Progress

## Current status

Phase 0 is complete. Phase 1 has not started. No deployment has been performed.

This document records implementation progress, verification results, limitations, and approved scope adjustments. Project setup and usage instructions belong in the root README.

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
