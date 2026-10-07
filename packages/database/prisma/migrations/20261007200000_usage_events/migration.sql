-- Security design 1.5: quiz creation and upload allowances per rolling
-- 24 hours. One row per quiz created and per image uploaded; rows outlive
-- what they count (deleting never restores an allowance) and are deleted
-- after two days by the cleanup job.
CREATE TYPE "UsageEventKind" AS ENUM ('QUIZ_CREATED', 'MEDIA_UPLOADED');

CREATE TABLE "usage_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "kind" "UsageEventKind" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "usage_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "usage_events_userId_kind_createdAt_idx" ON "usage_events"("userId", "kind", "createdAt");
CREATE INDEX "usage_events_createdAt_idx" ON "usage_events"("createdAt");
ALTER TABLE "usage_events" ADD CONSTRAINT "usage_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "usage_events" ENABLE ROW LEVEL SECURITY;
