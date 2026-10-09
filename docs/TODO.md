# TODO

Deferred follow-up work. Each item needs approval before implementation.

## Phase 11 — still open

Done on branch `phase-11-hardening`: the rate limiting item, the Phase 10 "end during a question" item and the earlier UI issues list (all removed from this file), plus backend Segments 1–6 and their frontend work. Still open:

- Segment 7: load test of a full live quiz (target participant count to be decided). On hold.


## Load quiz relations in one query (Prisma `relationJoins`)

Every authoring response reloads the full quiz with `quizInclude` (project, cover, questions, question images, options, registration count). Prisma currently runs one database round trip per relation, so with the dev database in Seoul (~180 ms per query) a reload alone costs about 1.7–2.6 s, and it follows every question save and quiz update.

Fix direction: enable the `relationJoins` preview feature in `packages/database/prisma/schema.prisma` and use `relationLoadStrategy: 'join'` for `quizInclude` reads, so each reload is a single SQL query. Regenerate the client and re-run every integration test. Hosting the production API near the database (e.g. Render Singapore for the Seoul database) matters more and should be done regardless.

## Before launch
- What to do for settings. => Done
- Handle session expire automatically => Done
- Create Home page/Landing page
- QA testing and issues fixes   
- Pages of footer => Done
- Load Test of Phase 11
- Track egress (download bandwidth) usage (security design 1.5 and 1.11): image reads from Supabase Storage are not measured yet, so there is no warning before the platform's bandwidth allowance runs out. Decide how to measure it (Supabase usage, or counting signed read URLs) and add a log alert like the storage ones.

## BE checks
- Check the cron job for unverified account deletation.

## UI QA Issues

- Add text color success whenever we are doing any success activity like password validation match text.
