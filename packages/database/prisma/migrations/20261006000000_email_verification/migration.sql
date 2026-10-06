-- Email verification and password reset (Phase 12).
ALTER TABLE "users" ADD COLUMN "emailVerifiedAt" TIMESTAMPTZ(3);

CREATE TYPE "OtpPurpose" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

-- At most one live code per user and purpose: issuing a new code replaces
-- the row, and a used, expired or exhausted code is deleted. Only an HMAC of
-- the code is stored.
CREATE TABLE "verification_codes" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" VARCHAR(64) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "verification_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "verification_codes_userId_purpose_key" ON "verification_codes"("userId", "purpose");
CREATE INDEX "verification_codes_expiresAt_idx" ON "verification_codes"("expiresAt");
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_attempts_non_negative" CHECK ("attempts" >= 0);
ALTER TABLE "verification_codes" ADD CONSTRAINT "verification_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "verification_codes" ENABLE ROW LEVEL SECURITY;
