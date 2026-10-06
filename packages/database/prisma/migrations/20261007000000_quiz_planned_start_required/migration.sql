-- A quiz leaves DRAFT only with a planned date/time. The quiz service and the
-- publish transaction already enforce this; the database now rejects it too.
ALTER TABLE "quizzes" ADD CONSTRAINT "quiz_planned_start_required"
  CHECK ("status" = 'DRAFT' OR "plannedStartAt" IS NOT NULL);
