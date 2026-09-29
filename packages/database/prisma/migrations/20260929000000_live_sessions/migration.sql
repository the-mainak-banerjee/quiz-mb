CREATE TYPE "LiveSessionState" AS ENUM ('LOBBY', 'LIVE_IDLE', 'QUESTION_ACTIVE', 'QUESTION_RESULT', 'LEADERBOARD', 'COMPLETED');

CREATE TABLE "live_quiz_sessions" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "hostUserId" UUID NOT NULL,
    "state" "LiveSessionState" NOT NULL DEFAULT 'LOBBY',
    "allowLateJoin" BOOLEAN NOT NULL,
    "startedAt" TIMESTAMPTZ(3),
    "endedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "live_quiz_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "participant_sessions" (
    "id" UUID NOT NULL,
    "liveSessionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "firstJoinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastJoinedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,
    CONSTRAINT "participant_sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "live_quiz_sessions_quizId_state_idx" ON "live_quiz_sessions"("quizId", "state");
CREATE INDEX "live_quiz_sessions_hostUserId_state_idx" ON "live_quiz_sessions"("hostUserId", "state");
CREATE UNIQUE INDEX "participant_sessions_liveSessionId_userId_key" ON "participant_sessions"("liveSessionId", "userId");
CREATE INDEX "participant_sessions_userId_idx" ON "participant_sessions"("userId");

-- Hard invariants: one unfinished live session per host and per quiz.
CREATE UNIQUE INDEX "live_quiz_sessions_one_active_per_host" ON "live_quiz_sessions"("hostUserId") WHERE "state" <> 'COMPLETED';
CREATE UNIQUE INDEX "live_quiz_sessions_one_active_per_quiz" ON "live_quiz_sessions"("quizId") WHERE "state" <> 'COMPLETED';
ALTER TABLE "live_quiz_sessions" ADD CONSTRAINT "live_quiz_sessions_timing_order" CHECK ("endedAt" IS NULL OR "startedAt" IS NULL OR "endedAt" >= "startedAt");

ALTER TABLE "live_quiz_sessions" ADD CONSTRAINT "live_quiz_sessions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "live_quiz_sessions" ADD CONSTRAINT "live_quiz_sessions_hostUserId_fkey" FOREIGN KEY ("hostUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "participant_sessions" ADD CONSTRAINT "participant_sessions_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "live_quiz_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "participant_sessions" ADD CONSTRAINT "participant_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "live_quiz_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "participant_sessions" ENABLE ROW LEVEL SECURITY;
