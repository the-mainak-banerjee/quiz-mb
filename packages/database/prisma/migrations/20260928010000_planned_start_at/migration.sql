-- The legacy SCHEDULED value was never an active authoring transition.
-- This migration intentionally fails if legacy rows still use it so they can
-- be resolved explicitly instead of being assigned a misleading lifecycle.
ALTER TYPE "QuizStatus" RENAME TO "QuizStatus_old";
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'LOBBY', 'LIVE', 'COMPLETED');

ALTER TABLE "quizzes"
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "QuizStatus" USING ("status"::text::"QuizStatus"),
  ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "QuizStatus_old";

ALTER TABLE "quizzes" RENAME COLUMN "scheduledAt" TO "plannedStartAt";
