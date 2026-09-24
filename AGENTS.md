# QuizMB Engineering Instructions

## Source of Truth

Use the documents in `/docs` only when the task requires product or architecture clarification.

Do not reread all documents for routine implementation work.

### Document authority

Use the following precedence:

1. `/docs/PRD.md`
   - Source of truth for product behavior
   - User flows
   - MVP scope
   - Delivery phase order
   - Functional requirements

2. `/docs/API_DESIGN.md`
   - Source of truth for REST API contract shape
   - Socket.IO contract shape
   - Request/response conventions
   - DTO and transport behavior

3. `/docs/DATABASE_REDIS_SOCKET_DESIGN.md`
   - Source of truth for database design
   - Redis state
   - persistence rules
   - realtime storage/recovery behavior
   - Socket.IO infrastructure decisions

4. `/docs/SYSTEM_DESIGN.md`
   - Source of truth for high-level architecture
   - application boundaries
   - deployment direction
   - backend module structure
   - infrastructure responsibilities

If documents appear to conflict:
- follow the precedence above,
- do not silently invent a resolution,
- ask before making a material architectural or product decision.

Do not treat implementation code as permission to contradict the approved documents.

## Reference Material

Files under `/references` are supporting material, not default context.

Do not read `/references` unless the task explicitly requires it.

`/references/design/DESIGN.md` is historical/reference documentation for the original visual design system.

The implemented frontend design system in `apps/web` is authoritative for normal frontend work.

## Approved Architecture

Follow the approved architecture:

- Next.js web
- Express API
- PostgreSQL + Prisma
- Redis
- Socket.IO
- Supabase
- pnpm + Turborepo

Do not introduce major libraries, services, frameworks, databases, auth providers, state-management libraries, or infrastructure changes without approval.

## Frontend

For frontend work, use the `frontend-design` skill.

The implemented frontend design system in `apps/web` is the source of truth for visual styling.

Reuse existing:

- design tokens
- typography
- buttons
- inputs
- cards
- badges
- layout primitives

Do not recreate them locally.

Do not invent new colors, font sizes, spacing, radii, shadows, or component variants unless explicitly required.

Prefer semantic design tokens over hardcoded visual values.

Before creating a new shared component:
1. Search for an existing implementation.
2. Reuse or extend it when appropriate.
3. Avoid duplicate abstractions for the same concept.

## Backend Boundaries

Keep backend transport layers thin.

Use the general flow:

Transport
→ validation/authentication
→ domain service
→ repository/infrastructure
→ PostgreSQL / Redis

Business logic should not live directly in:

- Express route handlers
- controllers
- Socket.IO handlers
- React components

The backend is authoritative for:

- quiz lifecycle
- timing
- answer eligibility
- accepted submissions
- correctness
- scoring
- ranking
- registration capacity
- live-session state

Do not trust client-provided competitive state.

## Workflow

Before coding:

1. Inspect existing code.
2. Read only the relevant docs for the task.
3. Reuse existing abstractions.
4. State the implementation plan.
5. Ask if a material decision is unclear.
6. Do not expand scope automatically.

After coding:

1. Run relevant formatting checks.
2. Run lint.
3. Run typecheck.
4. Run relevant tests/builds.
5. Report changed files.
6. Report tests/checks performed.
7. Report anything not verified.
8. Report known limitations.
9. Stop at the requested scope.

Do not automatically start the next phase.