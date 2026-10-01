CREATE TYPE "AskedQuestionStatus" AS ENUM ('ACTIVE', 'COMPLETED');
CREATE TYPE "AnswerStatus" AS ENUM ('SUBMITTED', 'NOT_ATTEMPTED');

CREATE TABLE "asked_questions" (
    "id" UUID NOT NULL,
    "liveSessionId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "status" "AskedQuestionStatus" NOT NULL DEFAULT 'ACTIVE',
    "durationSeconds" INTEGER NOT NULL,
    "startedAt" TIMESTAMPTZ(3) NOT NULL,
    "endsAt" TIMESTAMPTZ(3) NOT NULL,
    "completedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asked_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "answer_submissions" (
    "id" UUID NOT NULL,
    "askedQuestionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "AnswerStatus" NOT NULL DEFAULT 'SUBMITTED',
    "answerText" TEXT,
    "submittedAt" TIMESTAMPTZ(3),
    "responseTimeMs" INTEGER,
    "isCorrect" BOOLEAN,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "answer_submissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "answer_submission_options" (
    "answerSubmissionId" UUID NOT NULL,
    "questionOptionId" UUID NOT NULL,
    CONSTRAINT "answer_submission_options_pkey" PRIMARY KEY ("answerSubmissionId", "questionOptionId")
);

CREATE UNIQUE INDEX "asked_questions_liveSessionId_questionId_key" ON "asked_questions"("liveSessionId", "questionId");
CREATE UNIQUE INDEX "asked_questions_liveSessionId_sequenceNumber_key" ON "asked_questions"("liveSessionId", "sequenceNumber");
CREATE INDEX "asked_questions_liveSessionId_status_idx" ON "asked_questions"("liveSessionId", "status");
CREATE INDEX "asked_questions_questionId_idx" ON "asked_questions"("questionId");
CREATE UNIQUE INDEX "answer_submissions_askedQuestionId_userId_key" ON "answer_submissions"("askedQuestionId", "userId");
CREATE INDEX "answer_submissions_askedQuestionId_status_idx" ON "answer_submissions"("askedQuestionId", "status");
CREATE INDEX "answer_submissions_userId_createdAt_idx" ON "answer_submissions"("userId", "createdAt");
CREATE INDEX "answer_submission_options_questionOptionId_idx" ON "answer_submission_options"("questionOptionId");

-- Hard invariants: one active question per session, sane timing and points.
CREATE UNIQUE INDEX "asked_questions_one_active_per_session" ON "asked_questions"("liveSessionId") WHERE "status" = 'ACTIVE';
ALTER TABLE "asked_questions" ADD CONSTRAINT "asked_questions_sequence_positive" CHECK ("sequenceNumber" > 0);
ALTER TABLE "asked_questions" ADD CONSTRAINT "asked_questions_duration_positive" CHECK ("durationSeconds" > 0);
ALTER TABLE "asked_questions" ADD CONSTRAINT "asked_questions_timing_order" CHECK ("endsAt" > "startedAt" AND ("completedAt" IS NULL OR "completedAt" >= "startedAt"));
ALTER TABLE "answer_submissions" ADD CONSTRAINT "answer_submissions_points_non_negative" CHECK ("pointsAwarded" >= 0);
ALTER TABLE "answer_submissions" ADD CONSTRAINT "answer_submissions_response_time_non_negative" CHECK ("responseTimeMs" IS NULL OR "responseTimeMs" >= 0);

ALTER TABLE "asked_questions" ADD CONSTRAINT "asked_questions_liveSessionId_fkey" FOREIGN KEY ("liveSessionId") REFERENCES "live_quiz_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "asked_questions" ADD CONSTRAINT "asked_questions_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "answer_submissions" ADD CONSTRAINT "answer_submissions_askedQuestionId_fkey" FOREIGN KEY ("askedQuestionId") REFERENCES "asked_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "answer_submissions" ADD CONSTRAINT "answer_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "answer_submission_options" ADD CONSTRAINT "answer_submission_options_answerSubmissionId_fkey" FOREIGN KEY ("answerSubmissionId") REFERENCES "answer_submissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "answer_submission_options" ADD CONSTRAINT "answer_submission_options_questionOptionId_fkey" FOREIGN KEY ("questionOptionId") REFERENCES "question_options"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "asked_questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "answer_submissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "answer_submission_options" ENABLE ROW LEVEL SECURITY;
