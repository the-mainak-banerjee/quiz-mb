---
name: backend-design
description: Use for QuizMB backend work in apps/api, packages/contracts and packages/database — REST routes, Socket.IO handlers, services, repositories, Prisma migrations, Redis and tests.
---

# QuizMB Backend Rules

## Core Principle

The backend is the only authority for quiz lifecycle, timing, answer
eligibility, correctness, scoring, ranking, registration capacity and
live-session state. Never trust client-provided competitive values (user id,
points, correctness, response time, timestamps, role).

Read `/docs/API_DESIGN.md` or `/docs/DATABASE_REDIS_SOCKET_DESIGN.md` only for
the sections the task touches. Follow the document precedence in `AGENTS.md`.

## Layers

```text
Transport (Express route / Socket.IO handler)
→ validation + authentication
→ domain service (business rules)
→ repository (Prisma) / infrastructure (Redis, storage)
→ PostgreSQL / Redis
```

- Routes and socket handlers stay thin: parse, validate, call one service
  method, shape the response. No business rules, no Prisma calls.
- Services own rules and orchestration; they throw `ApiError`.
- Repositories own queries and transactions; they return rows, not DTOs.
- DTO shaping happens in the service (role-safe snapshots, public views).

## Module Layout

Each feature lives in `apps/api/src/modules/<feature>/`:

```text
routes.ts        Express router factory, e.g. registrationRoutes(service)
service.ts       <Feature>Service class, constructor-injected dependencies
repository.ts    <Feature>Repository class wrapping PrismaClient
realtime.ts      Socket.IO namespace attach function (live features only)
constants.ts     API-only values for this module (rooms, Redis keys, ops)
```

- Wire dependencies in the composition roots: `src/index.ts`, `src/app.ts`,
  `src/server.ts` and `src/modules/authoring.ts`. Do not construct services
  inside routes or handlers.
- Cross-module calls go through the other module's service, never its
  repository.
- ESM: relative imports end in `.js`.

## Constants, Not Strings

No raw wire strings in code. Every status, role, event name, error code,
header, cookie name or Redis key comes from a constant.

- Shared with the web app → `packages/contracts/src/constants.ts` as an
  `as const` object plus a derived union type (`QUIZ_STATUS`,
  `LIVE_SESSION_STATE`, `ANSWER_STATUS`, `ERROR_CODE`, ...).
- Socket event names → `LIVE_EVENTS` (and similar) in
  `packages/contracts/src/index.ts`.
- API-only values → `apps/api/src/config/constants.ts` (global) or the
  module's `constants.ts` (rooms, ticket kinds, `presenceKey()`, `lockKey()`).
- Values mirroring a Prisma enum must be added to `src/config/enum-sync.ts`
  so a mismatch fails `tsc`.
- Limits live in contracts (`AUTHORING_LIMITS`, `ANSWER_LIMITS`, ...).

## Contracts and Validation

- Request bodies, socket payloads and DTO types are defined once in
  `@quizmb/contracts` (Zod schemas + exported types). Rebuild contracts after
  changing them.
- Socket command schemas are `.strict()` so unknown fields are rejected.
- Validate params, query and bodies with `validate(schema, value)`; ids are
  `z.uuid()`.
- Never accept identity from the payload; use `res.locals.userId` (REST) or
  `socket.data.userId` (from the verified ticket).

## Errors and Responses

- Throw `new ApiError(status, ERROR_CODE.X, 'Human message.', details?)`.
- REST success: `{ success: true, data }`. Errors are produced only by
  `errorHandler`: `{ success: false, error: { code, message, details,
requestId } }`.
- Socket commands acknowledge with `SocketAck<T>`:
  `{ ok: true, data }` or `{ ok: false, error: { code, message } }`. Unknown
  errors are logged and returned as `INTERNAL_ERROR` without internals.
- Add new codes to `ERROR_CODE`; the web app maps codes to copy.

## PostgreSQL and Prisma

- Schema in `packages/database/prisma/schema.prisma`; every change ships a
  migration in `prisma/migrations/<timestamp>_<name>/migration.sql`.
- Protect invariants in the database too: unique constraints, partial unique
  indexes, CHECK constraints, foreign keys. Application checks alone are not
  enough under concurrency.
- Serialize contested writes with interactive transactions plus row locks
  (`SELECT ... FOR UPDATE`). Lock order is users → quizzes → live sessions
  to avoid deadlocks.
- Pass `lockedTransaction` options to transactions that queue on row locks
  (the connection pool is small).
- Treat unique violations (`P2002`) as the expected race outcome and convert
  them to a domain result or `ApiError`, not a 500.
- New tables get RLS enabled; the API remains the only data path.

## Redis (Upstash free tier)

- Redis holds only short-lived, rebuildable state: presence, locks, live
  aggregates. PostgreSQL is the source of truth.
- Keep command counts low: no polling, no `KEYS`/`SCAN` loops, no pub/sub.
  Prefer in-process memory for single-instance counters and throttling.
- Multi-step atomic updates use Lua scripts (see `live-store.ts`).
- Transitions that must happen once use `store.withLock(op, id, work)` and
  re-check PostgreSQL state inside the lock.
- Build keys with the helpers in the module `constants.ts`; set TTLs on
  anything that can outlive a session.

## Socket.IO

- Handshakes are cookie-free: short-lived ticket JWTs from `SocketTickets`,
  one audience per ticket kind. Web and API run on different domains.
- Handlers authenticate, validate, delegate to the service, then emit.
- Emit role-specific payloads to audience rooms (`liveRoom(id, audience)`).
  Participant payloads must never contain correct answers, `isCorrect`,
  other participants' data or live distribution before reveal.
- Re-derive role and session membership on every command; enforce one active
  socket per participant (newest device wins).
- Throttle broadcasts that scale with participants (leading + trailing).
- Cross-module notifications use in-process `DomainEvents`
  (`DOMAIN_EVENT.*`); this assumes a single API instance.

## Time

- All deadlines come from server time and persisted timestamps (`endsAt`).
  Client clocks are display only.
- Every timed state needs a recovery path: an in-process timer plus a check
  on the next interaction (sync, join, submit, host action) that finalizes
  anything already past its deadline.

## Logging and Secrets

- Use the injected pino `logger`; log codes and ids, never tokens, passwords,
  cookies, answers' private data or env values.
- Configuration comes only from `src/config/env.ts`; secrets stay in ignored
  `.env` files.

## Tests

- Runner: `node:test` with `tsx`. Unit tests in `tests/*.test.ts`;
  integration tests in `tests/*.integration.test.ts` against the real dev
  database and Redis.
- Integration tests create their own users and data with unique emails and
  clean up in `finally`. Cover the race conditions a rule exists for
  (concurrent requests, duplicate submissions, expiry boundaries).
- Reuse accounts from `docs/test-credentials.md` for manual QA; never commit
  that file.

## Before Finishing

Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, the API unit tests,
the relevant integration tests and the build. Report changed files, checks
run, anything unverified and known limitations. Update `docs/API_DESIGN.md`
implementation notes when a contract changes.
