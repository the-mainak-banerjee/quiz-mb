-- Security design 1.6: host disconnect grace and the hosted-session
-- allowance (lobby expiry and the 4-hour limit derive from createdAt and
-- startedAt).
ALTER TABLE "live_quiz_sessions" ADD COLUMN "hostDisconnectedAt" TIMESTAMPTZ(3);

-- One row per started live quiz, counted per calendar month (UTC).
ALTER TYPE "UsageEventKind" ADD VALUE 'SESSION_STARTED';
