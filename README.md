# Quiz MB

Quiz MB is a host-controlled live quiz platform designed for creating quizzes within projects, registering participants, running questions in real time, and saving results. Hosts control question progression and leaderboard visibility; the server owns timing, answer acceptance, scoring, and ranking.

## Architecture

- **Web:** Next.js App Router, React, and Tailwind CSS.
- **API:** Express and TypeScript, with REST for business operations.
- **Database:** Supabase PostgreSQL with Prisma.
- **Realtime design:** Socket.IO with Upstash Redis coordination.
- **Media storage design:** Supabase Storage.
- **Workspace:** pnpm and Turborepo.
- **Hosting:** Separate Vercel applications for web and API.

The backend follows a modular monolith architecture. The web application accesses business data through the API rather than connecting directly to the database. Backend services remain independent of Next.js to support a future React Native client.

## Repository structure

```text
apps/
  web/              Next.js application
  api/              Express application
packages/
  config/           Shared TypeScript and ESLint configuration
  database/         Prisma configuration and database tooling
docs/               Product, architecture, API, and progress documents
```

## Requirements

- Node.js 24 LTS, as specified in `.node-version`.
- pnpm 10.30.3, pinned in the root `package.json`.
- Development Supabase credentials for database connectivity checks.

## Local setup

From the repository root, install dependencies:

```sh
pnpm install
```

Copy the environment templates:

- `apps/web/.env.example` to `apps/web/.env.local`.
- `apps/api/.env.example` to `apps/api/.env`.
- `packages/database/.env.example` to `packages/database/.env`.

Set the API's `DATABASE_URL` and a random `AUTH_ACCESS_SECRET` (at least 32 random bytes, encoded as base64url). Set `DIRECT_DATABASE_URL` in the database tooling environment to the development Supabase Session pooler URL. Apply the checked-in migrations and build the database package before starting an individual application:

```sh
pnpm --filter @quizmb/database db:migrate
pnpm --filter @quizmb/database build
```

Local environment files are ignored by Git. Start both applications:

```sh
pnpm dev
```

- Web: <http://localhost:3000>
- API health: <http://localhost:4000/api/health>

To run either application independently:

```sh
pnpm --filter @quizmb/web dev
pnpm --filter @quizmb/api dev
```

Stop local servers with Ctrl+C.

## Development commands

- `pnpm format:check` — check formatting; the `docs` directory is excluded.
- `pnpm format` — format source and configuration files.
- `pnpm lint` — run ESLint and import-boundary checks.
- `pnpm typecheck` — check application, test, and database configuration types.
- `pnpm test` — run automated tests.
- `pnpm build` — build the web and API applications for production.
- `pnpm db:check` — run the read-only database connectivity probe.
- `pnpm --filter @quizmb/api test:integration` — exercise the auth lifecycle against the development database; creates and removes uniquely named test accounts. Never use production credentials.

`pnpm --filter @quizmb/web test` runs the global API client's isolated unit tests without a server or database.

After building, start the applications locally with:

```sh
pnpm --filter @quizmb/web start
pnpm --filter @quizmb/api start
```

## Environment configuration

### Web

`NEXT_PUBLIC_API_URL` specifies the exact API origin (no trailing slash). It defaults to `http://localhost:4000` in development and `https://api.quizmb.com` in production, where HTTPS is required. It is public build-time configuration; never place credentials in a `NEXT_PUBLIC_` variable.

Browser requests go directly to Express using the global [API client](apps/web/src/lib/api/README.md), including authentication and future feature calls. There are no Next.js API forwarding routes or refresh proxy. Server Components still validate access with Express before rendering protected content. Database URLs and signing secrets belong only to the API.

### API

- `NODE_ENV` — `development`, `test`, or `production`.
- `PORT` — local listening port; defaults to `4000`.
- `HOST` — local listening host; defaults to `localhost`.
- `ALLOWED_ORIGINS` — comma-separated exact HTTP(S) origins, without paths or trailing slashes. Defaults locally to `http://localhost:3000` and must be explicitly configured in production.
- `LOG_LEVEL` — structured logging level; defaults to `info`.
- `DATABASE_URL` — Supabase PostgreSQL connection for the API; prefer the transaction pooler on port 6543 for Vercel.
- `DATABASE_SSL_CA_BASE64` — optional base64 PEM for the official Supabase CA when the local trust store cannot validate the pooler certificate. TLS certificate verification remains enabled.
- `AUTH_ACCESS_SECRET` — random signing secret, at least 43 characters; keep separate for each environment.
- `AUTH_ACCESS_TTL_SECONDS` — access credential lifetime, default 900 seconds (15 minutes).
- `AUTH_SESSION_TTL_SECONDS` — absolute refresh-session lifetime, default 2592000 seconds (30 days).
- `AUTH_COOKIE_DOMAIN` — required in production: `quizmb.com`. Shares only the access cookie across web/API; omit on localhost.

Signup creates an active account immediately. Passwords accept 15–128 Unicode characters, including spaces, and are hashed with Argon2id. Express sets HttpOnly, SameSite=Lax cookies directly. Production access uses `__Secure-quizmb-access` with Domain=quizmb.com; refresh uses API-host-only `__Host-quizmb-refresh`. Both are Secure. Tokens are never stored in browser JavaScript storage.

The access cookie is retained until session expiry so server pages can recognize expired access and offer `/session` with an explicit Continue session action. Its JWT is still valid for only 15 minutes; expired credentials never authorize a request. The action renews directly with Express, without useEffect fetching. Protected browser API calls can refresh and retry once automatically. Sign-in pages remain accessible for starting a new session.

Production requires trusted subdomains under the same site, such as app.quizmb.com and api.quizmb.com. A Domain cookie reaches all subdomains: do not host untrusted applications under quizmb.com. Unrelated Vercel preview domains cannot use this cookie setup. Existing production BFF sessions require a fresh login after switching cookie names; old web-host-only cookies are no longer read. Use localhost for both local applications (do not mix localhost and 127.0.0.1).

Express owns authentication and profile data. Access credentials reference persisted sessions. Refresh rotates the stored token hash atomically; reuse revokes the session family. Simultaneous refreshes in different browser tabs may require signing in again under this strict replay policy. Logout revokes the current session family. Unsafe requests require an allowed Origin and JSON content type. Authentication rate limiting is intentionally deferred; add distributed limits before public rollout.

`GET /api/health` returns `{"status":"ok"}` to indicate application liveness, not database readiness. Responses include a server-generated `X-Request-ID` for correlation with application logs.

### Database tooling

Copy `packages/database/.env.example` to `packages/database/.env` and set `DIRECT_DATABASE_URL` to the development Supabase database's direct or session-pooler connection URL with TLS enabled.

```sh
pnpm db:check
```

The probe executes `SELECT 1` inside a read-only transaction and rolls it back. It verifies connectivity without creating tables or modifying data. It does not validate a product schema. Database checks do not run automatically during builds or tests.

Keep development resources separate from production, and never commit credentials.

## Vercel configuration

Use two independent Vercel projects with Node.js 24 and the repository's pnpm lockfile. Allow access to workspace files outside each project's root directory so shared configuration resolves.

### Web project

- Root directory: `apps/web`.
- Framework preset: Next.js.
- Build command: `pnpm build`.
- Planned domain: `app.quizmb.com`.
- Production environment: `NEXT_PUBLIC_API_URL=https://api.quizmb.com`.

### API project

- Root directory: `apps/api`.
- Framework preset: Express.
- Build command: `pnpm --filter @quizmb/api... build` (includes the database package and generated Prisma client).
- Entry point: `src/index.ts`.
- Planned domain: `api.quizmb.com`.
- Production environment: `NODE_ENV=production`, `ALLOWED_ORIGINS=https://app.quizmb.com`, `AUTH_COOKIE_DOMAIN=quizmb.com`, `LOG_LEVEL=info`, `DATABASE_URL`, `AUTH_ACCESS_SECRET`, and optional `DATABASE_SSL_CA_BASE64`. Apply migrations separately with the tooling connection before release; builds do not migrate databases.

`src/app.ts` constructs the Express application, `src/index.ts` exports it for Vercel, and `src/server.ts` starts the local listener. Do not use the local listener as the Vercel entry point.

Keep production secrets out of preview environments. Preview origins require explicit CORS configuration.

## Documentation

- [Product requirements](docs/PRD.md)
- [System architecture](docs/SYSTEM_DESIGN.md)
- [Database, Redis, and Socket.IO design](docs/DATABASE_REDIS_SOCKET_DESIGN.md)
- [API design](docs/API_DESIGN.md)
- [Development progress and verification](docs/PROGRESS.MD)
