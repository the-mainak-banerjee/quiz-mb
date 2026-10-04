-- Registration in one database call. The quiz row lock is held only while
-- this function runs (milliseconds) instead of across several network round
-- trips, so bursts of registrations are processed quickly while capacity
-- stays exact.
--
-- Every statement in a VOLATILE PL/pgSQL function takes a fresh snapshot
-- under READ COMMITTED, so the count below (taken after the lock is granted)
-- sees every registration committed by the transactions that held it first.
--
-- `outcome` is 'REGISTERED' or an API error code; the API maps it.
CREATE FUNCTION "register_participant"("p_quiz_id" uuid, "p_user_id" uuid)
RETURNS TABLE (
    "outcome" text,
    "registrationId" uuid,
    "registeredAt" timestamptz,
    "registrationCount" integer
)
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
    v_project_id uuid;
    v_creator_id uuid;
    v_limit integer;
    v_status text;
    v_existing_id uuid;
    v_existing_status text;
    v_count integer;
    v_registration_id uuid;
    v_now timestamptz := now();
BEGIN
    SELECT q."projectId", q."creatorUserId", q."registrationLimit", q."status"::text
      INTO v_project_id, v_creator_id, v_limit, v_status
      FROM "quizzes" AS q
     WHERE q."id" = p_quiz_id
       FOR UPDATE;
    IF NOT FOUND THEN
        RETURN QUERY SELECT 'NOT_FOUND', NULL::uuid, NULL::timestamptz, 0;
        RETURN;
    END IF;
    IF v_creator_id = p_user_id THEN
        RETURN QUERY SELECT 'HOST_CANNOT_REGISTER', NULL::uuid, NULL::timestamptz, 0;
        RETURN;
    END IF;
    -- Registration stays open in the lobby and closes when the host starts.
    IF v_status NOT IN ('PUBLISHED', 'LOBBY') THEN
        RETURN QUERY SELECT
            CASE WHEN v_status = 'COMPLETED' THEN 'QUIZ_COMPLETED' ELSE 'REGISTRATION_CLOSED' END,
            NULL::uuid, NULL::timestamptz, 0;
        RETURN;
    END IF;

    SELECT r."id", r."status"::text
      INTO v_existing_id, v_existing_status
      FROM "quiz_registrations" AS r
     WHERE r."quizId" = p_quiz_id AND r."userId" = p_user_id;
    IF v_existing_status = 'REGISTERED' THEN
        RETURN QUERY SELECT 'ALREADY_REGISTERED', NULL::uuid, NULL::timestamptz, 0;
        RETURN;
    END IF;

    SELECT count(*)::integer
      INTO v_count
      FROM "quiz_registrations" AS r
     WHERE r."quizId" = p_quiz_id AND r."status" = 'REGISTERED';
    IF v_count >= v_limit THEN
        RETURN QUERY SELECT 'QUIZ_FULL', NULL::uuid, NULL::timestamptz, v_count;
        RETURN;
    END IF;

    IF v_existing_id IS NOT NULL THEN
        UPDATE "quiz_registrations"
           SET "status" = 'REGISTERED', "registeredAt" = v_now, "cancelledAt" = NULL
         WHERE "id" = v_existing_id;
        v_registration_id := v_existing_id;
    ELSE
        INSERT INTO "quiz_registrations" ("id", "quizId", "userId", "status", "registeredAt")
        VALUES (gen_random_uuid(), p_quiz_id, p_user_id, 'REGISTERED', v_now)
        RETURNING "id" INTO v_registration_id;
    END IF;

    INSERT INTO "project_associations" ("id", "projectId", "userId", "createdViaQuizId", "createdAt")
    VALUES (gen_random_uuid(), v_project_id, p_user_id, p_quiz_id, v_now)
    ON CONFLICT ("projectId", "userId") DO NOTHING;

    RETURN QUERY SELECT 'REGISTERED', v_registration_id, v_now, v_count + 1;
END;
$$;

-- Only the API's database role may call it: never Supabase's Data API roles.
REVOKE ALL ON FUNCTION "register_participant"(uuid, uuid) FROM PUBLIC;
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
        REVOKE ALL ON FUNCTION "register_participant"(uuid, uuid) FROM anon;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        REVOKE ALL ON FUNCTION "register_participant"(uuid, uuid) FROM authenticated;
    END IF;
END
$$;
