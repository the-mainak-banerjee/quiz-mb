UPDATE "quiz_registrations" AS registration
SET
    "status" = 'CANCELLED',
    "cancelledAt" = CURRENT_TIMESTAMP
FROM "quizzes" AS quiz
WHERE registration."quizId" = quiz."id"
  AND registration."userId" = quiz."creatorUserId"
  AND registration."status" = 'REGISTERED';

DELETE FROM "project_associations" AS association
USING "projects" AS project
WHERE association."projectId" = project."id"
  AND association."userId" = project."ownerUserId";
