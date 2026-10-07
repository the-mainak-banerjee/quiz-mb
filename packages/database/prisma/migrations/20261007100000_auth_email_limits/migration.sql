-- Security design 1.1: per-address email limits, failures across resends,
-- the daily email budget and the cleanup of never-verified accounts.
CREATE TYPE "AuthEmailEventKind" AS ENUM ('SENT', 'CODE_FAILED');

-- One row per auth email sent and per wrong code entered. Rows are counted
-- over rolling windows (1 hour, 24 hours, 30 minutes, the current day) and
-- deleted after two days by the cleanup job.
CREATE TABLE "auth_email_events" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "kind" "AuthEmailEventKind" NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "auth_email_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "auth_email_events_userId_purpose_kind_createdAt_idx" ON "auth_email_events"("userId", "purpose", "kind", "createdAt");
CREATE INDEX "auth_email_events_kind_createdAt_idx" ON "auth_email_events"("kind", "createdAt");
ALTER TABLE "auth_email_events" ADD CONSTRAINT "auth_email_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "auth_email_events" ENABLE ROW LEVEL SECURITY;

-- Finds never-verified accounts by age for the 7-day cleanup.
CREATE INDEX "users_unverified_createdAt_idx" ON "users"("createdAt") WHERE "emailVerifiedAt" IS NULL;
