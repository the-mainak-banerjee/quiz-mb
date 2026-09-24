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

To override local defaults, copy:

- `apps/web/.env.example` to `apps/web/.env.local`.
- `apps/api/.env.example` to `apps/api/.env`.

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

After building, start the applications locally with:

```sh
pnpm --filter @quizmb/web start
pnpm --filter @quizmb/api start
```

## Environment configuration

### Web

`NEXT_PUBLIC_API_URL` specifies the API origin and defaults to `http://localhost:4000`. It is public build-time configuration; never place credentials in a `NEXT_PUBLIC_` variable.

### API

- `NODE_ENV` — `development`, `test`, or `production`.
- `PORT` — local listening port; defaults to `4000`.
- `HOST` — local listening host; defaults to `localhost`.
- `ALLOWED_ORIGINS` — comma-separated exact HTTP(S) origins, without paths or trailing slashes. Defaults locally to `http://localhost:3000` and must be explicitly configured in production.
- `LOG_LEVEL` — structured logging level; defaults to `info`.

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
- Build command: `pnpm build`.
- Entry point: `src/index.ts`.
- Planned domain: `api.quizmb.com`.
- Production environment: `NODE_ENV=production`, `ALLOWED_ORIGINS=https://app.quizmb.com`, and `LOG_LEVEL=info`.

`src/app.ts` constructs the Express application, `src/index.ts` exports it for Vercel, and `src/server.ts` starts the local listener. Do not use the local listener as the Vercel entry point.

Keep production secrets out of preview environments. Preview origins require explicit CORS configuration.

## Documentation

- [Product requirements](docs/PRD.md)
- [System architecture](docs/SYSTEM_DESIGN.md)
- [Database, Redis, and Socket.IO design](docs/DATABASE_REDIS_SOCKET_DESIGN.md)
- [API design](docs/API_DESIGN.md)
- [Development progress and verification](docs/PROGRESS.MD)
