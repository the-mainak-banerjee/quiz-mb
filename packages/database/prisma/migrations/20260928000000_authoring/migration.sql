-- CreateEnum
CREATE TYPE "QuizStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SCHEDULED', 'LOBBY', 'LIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'DESCRIPTIVE');

-- CreateEnum
CREATE TYPE "MediaPurpose" AS ENUM ('QUIZ_COVER', 'QUESTION_IMAGE');

-- CreateEnum
CREATE TYPE "MediaStatus" AS ENUM ('PENDING', 'READY', 'DELETED');

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "description" VARCHAR(240) NOT NULL DEFAULT '',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quizzes" (
    "id" UUID NOT NULL,
    "publicId" TEXT NOT NULL,
    "projectId" UUID NOT NULL,
    "creatorUserId" UUID NOT NULL,
    "title" VARCHAR(90) NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "registrationLimit" INTEGER NOT NULL,
    "defaultQuestionDurationSeconds" INTEGER NOT NULL,
    "allowLateJoin" BOOLEAN NOT NULL DEFAULT true,
    "scheduledAt" TIMESTAMPTZ(3),
    "status" "QuizStatus" NOT NULL DEFAULT 'DRAFT',
    "coverMediaId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "quizzes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "questions" (
    "id" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "type" "QuestionType" NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "durationOverrideSeconds" INTEGER,
    "imageMediaId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "question_options" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,

    CONSTRAINT "question_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_assets" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID NOT NULL,
    "quizId" UUID NOT NULL,
    "purpose" "MediaPurpose" NOT NULL,
    "status" "MediaStatus" NOT NULL DEFAULT 'PENDING',
    "bucket" TEXT NOT NULL,
    "objectPath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readyAt" TIMESTAMPTZ(3),

    CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_ownerUserId_createdAt_idx" ON "projects"("ownerUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "quizzes_publicId_key" ON "quizzes"("publicId");

-- CreateIndex
CREATE INDEX "quizzes_projectId_status_idx" ON "quizzes"("projectId", "status");

-- CreateIndex
CREATE INDEX "quizzes_creatorUserId_createdAt_idx" ON "quizzes"("creatorUserId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "questions_quizId_position_key" ON "questions"("quizId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "question_options_questionId_position_key" ON "question_options"("questionId", "position");

-- CreateIndex
CREATE INDEX "media_assets_ownerUserId_quizId_idx" ON "media_assets"("ownerUserId", "quizId");

-- CreateIndex
CREATE UNIQUE INDEX "media_assets_bucket_objectPath_key" ON "media_assets"("bucket", "objectPath");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_creatorUserId_fkey" FOREIGN KEY ("creatorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "questions" ADD CONSTRAINT "questions_imageMediaId_fkey" FOREIGN KEY ("imageMediaId") REFERENCES "media_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "question_options" ADD CONSTRAINT "question_options_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Hard invariants not expressible in the Prisma schema.
ALTER TABLE "quizzes" ADD CONSTRAINT "quiz_capacity_positive" CHECK ("registrationLimit" > 0), ADD CONSTRAINT "quiz_duration_positive" CHECK ("defaultQuestionDurationSeconds" > 0);
ALTER TABLE "questions" ADD CONSTRAINT "question_position_positive" CHECK ("position" >= 0), ADD CONSTRAINT "question_duration_positive" CHECK ("durationOverrideSeconds" IS NULL OR "durationOverrideSeconds" > 0);
ALTER TABLE "question_options" ADD CONSTRAINT "option_position_positive" CHECK ("position" >= 0);
ALTER TABLE "media_assets" ADD CONSTRAINT "media_size_bounds" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 10485760);
-- Application-owned auth uses the direct server connection. No Supabase anon
-- or authenticated API role should read host drafts or answer keys.
ALTER TABLE "projects" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "quizzes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "questions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "question_options" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;
