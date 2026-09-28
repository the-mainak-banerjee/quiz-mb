CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'CANCELLED');

ALTER TABLE "quizzes" ADD COLUMN "publishedAt" TIMESTAMPTZ(3);

CREATE TABLE "project_associations" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "createdViaQuizId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_associations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quiz_registrations" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "registeredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMPTZ(3),
    CONSTRAINT "quiz_registrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "project_associations_projectId_userId_key" ON "project_associations"("projectId", "userId");
CREATE INDEX "project_associations_userId_createdAt_idx" ON "project_associations"("userId", "createdAt");
CREATE UNIQUE INDEX "quiz_registrations_quizId_userId_key" ON "quiz_registrations"("quizId", "userId");
CREATE INDEX "quiz_registrations_quizId_status_idx" ON "quiz_registrations"("quizId", "status");
CREATE INDEX "quiz_registrations_userId_status_idx" ON "quiz_registrations"("userId", "status");
CREATE INDEX "quiz_registrations_userId_registeredAt_idx" ON "quiz_registrations"("userId", "registeredAt");
CREATE INDEX "quizzes_status_plannedStartAt_idx" ON "quizzes"("status", "plannedStartAt");

ALTER TABLE "project_associations" ADD CONSTRAINT "project_associations_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_associations" ADD CONSTRAINT "project_associations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_associations" ADD CONSTRAINT "project_associations_createdViaQuizId_fkey" FOREIGN KEY ("createdViaQuizId") REFERENCES "quizzes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quiz_registrations" ADD CONSTRAINT "quiz_registrations_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quiz_registrations" ADD CONSTRAINT "quiz_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "project_associations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quiz_registrations" ENABLE ROW LEVEL SECURITY;
