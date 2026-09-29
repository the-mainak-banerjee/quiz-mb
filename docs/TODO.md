# TODO

Deferred follow-up work. Each item needs approval before implementation.

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
