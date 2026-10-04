ALTER TABLE "live_quiz_sessions" ADD COLUMN "finalLeaderboardShownAt" TIMESTAMPTZ(3);

CREATE TABLE "quiz_results" (
    "id" UUID NOT NULL,
    "liveSessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "totalScore" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "correctCount" INTEGER NOT NULL,
    "incorrectCount" INTEGER NOT NULL,
    "notAttemptedCount" INTEGER NOT NULL,
    "finalizedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "quiz_results_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "quiz_results_liveSessionId_userId_key" ON "quiz_results"("liveSessionId", "userId");
CREATE INDEX "quiz_results_liveSessionId_rank_idx" ON "quiz_results"("liveSessionId", "rank");
CREATE INDEX "quiz_results_userId_finalizedAt_idx" ON "quiz_results"("userId", "finalizedAt");

ALTER TABLE "quiz_results" ADD CONSTRAINT "quiz_results_counts_non_negative" CHECK ("totalScore" >= 0 AND "rank" > 0 AND "correctCount" >= 0 AND "incorrectCount" >= 0 AND "notAttemptedCount" >= 0);

ALTER TABLE "quiz_results" ADD CONSTRAINT "quiz_results_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "live_quiz_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_results" ADD CONSTRAINT "quiz_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quiz_results" ENABLE ROW LEVEL SECURITY;
