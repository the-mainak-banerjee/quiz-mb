# Live Quiz Platform
## Database, Redis & Socket.IO Design Document

**Version:** V1  
**Status:** MVP Design Baseline  
**Parent Document:** System Design Architecture  
**Database:** PostgreSQL on Supabase  
**ORM:** Prisma  
**Realtime State:** Upstash Redis  
**Realtime Transport:** Socket.IO  
**Backend:** Express + TypeScript  
**Architecture:** Modular Monolith  
**Target MVP Scale:** ~500 concurrent participants per live quiz

---

# 1. Purpose

This document defines the detailed persistence and realtime design for the **Live Quiz Platform**.

The three concerns are intentionally documented together because they form one live-session consistency model:

```text
PostgreSQL
    +
Redis
    +
Socket.IO
```

PostgreSQL stores durable facts.

Redis stores fast-changing operational state.

Socket.IO transports realtime state changes between the backend, host and participants.

This document defines:

- PostgreSQL entities and relationships
- Prisma modelling direction
- Enums
- Primary and foreign keys
- Uniqueness constraints
- Important database indexes
- Transaction boundaries
- Registration-capacity integrity
- Authentication-session persistence
- Quiz/question persistence
- Live-session persistence
- Asked-question modelling
- Answer-submission persistence
- Final-result persistence
- Media metadata
- Redis key strategy
- Redis data structures
- Redis TTL rules
- Presence state
- Active-question state
- Distribution counters
- Leaderboard state
- Rate-limit state
- Distributed coordination
- Redis recovery strategy
- Socket.IO namespaces and rooms
- Socket authentication
- Socket event contracts
- Event acknowledgements
- Host events
- Participant events
- Reconnection/state-sync flow
- Question-expiry flow
- Realtime consistency rules
- Failure recovery

This document does **not** define:

- Exact REST endpoint contracts
- Final scoring mathematics
- Exact frontend component design
- Exact application folder structure
- Deployment environment variables
- Full security implementation
- Detailed UI states

Those belong to later documents.

---

# 2. Core Data Ownership Principle

The system follows this rule:

```text
PostgreSQL = Durable Truth

Redis = Operational Realtime State

Socket.IO = Realtime Transport
```

Examples:

```text
"Question Q5 exists"
→ PostgreSQL

"Q5 is currently active and ends at 12:04:20.500Z"
→ Redis + PostgreSQL AskedQuestion timing

"Participant submitted B for Q5"
→ PostgreSQL

"Option B currently has 137 live responses"
→ Redis

"Rahul currently has 4,820 points"
→ PostgreSQL submissions + Redis leaderboard

"Host switched everyone to leaderboard"
→ Redis live state + Socket.IO broadcast

"Final rank is #4"
→ PostgreSQL QuizResult
```

Redis must never become the only location of information required for permanent quiz history.

---

# 3. Database Design Principles

## 3.1 Use Relational Integrity

The domain is strongly relational.

Examples:

```text
Project belongs to User
Quiz belongs to Project
Question belongs to Quiz
Registration belongs to Quiz + User
AskedQuestion belongs to LiveQuizSession + Question
AnswerSubmission belongs to AskedQuestion + User
QuizResult belongs to LiveQuizSession + User
```

PostgreSQL should enforce important relationships through foreign keys.

## 3.2 Prefer Database Constraints for Hard Invariants

Application validation is important, but hard integrity rules should also be expressed in PostgreSQL where practical.

Examples:

```text
One account per email
One registration per user per quiz
One answer per user per asked question
One result per user per live session
Question option belongs to exactly one question
```

## 3.3 Business Rules Still Live in Services

Not every rule can or should be expressed through SQL constraints.

Examples:

```text
Single-choice question must have exactly one correct option.
Multiple-choice question must have at least one correct option.
Descriptive question must not have answer options.
Only quiz creator can start the quiz.
A completed question cannot be replayed.
A question cannot be edited once the quiz is live.
```

These belong primarily in domain services.

## 3.4 UTC Everywhere

All server timestamps are stored in UTC.

Use timezone-aware PostgreSQL timestamps conceptually equivalent to:

```text
TIMESTAMPTZ
```

Frontend converts to local timezone for display.

## 3.5 IDs

Recommended primary-key strategy:

```text
UUID
```

or a similarly non-sequential globally safe identifier supported cleanly by Prisma/PostgreSQL.

Public quiz links should use a separate stable public identifier rather than exposing internal database IDs.

---

# 4. Entity Relationship Overview

```text
User
 ├── AuthSession
 ├── Project (owner)
 ├── ProjectAssociation
 ├── QuizRegistration
 ├── ParticipantSession
 ├── AnswerSubmission
 └── QuizResult

Project
 ├── Quiz
 └── ProjectAssociation

Quiz
 ├── Question
 │    └── QuestionOption
 ├── QuizRegistration
 └── LiveQuizSession
      ├── ParticipantSession
      ├── AskedQuestion
      │    └── AnswerSubmission
      │         └── AnswerSubmissionOption
      └── QuizResult

MediaAsset
 ├── User avatar reference
 ├── Project cover reference
 ├── Quiz cover reference
 └── Question image reference
```

---

# 5. Enumerations

Recommended application/database enums:

```text
QuizStatus
---------
DRAFT
PUBLISHED
SCHEDULED
LOBBY
LIVE
COMPLETED
```

```text
QuestionType
------------
SINGLE_CHOICE
MULTIPLE_CHOICE
DESCRIPTIVE
```

```text
RegistrationStatus
------------------
REGISTERED
CANCELLED
```

```text
LiveSessionState
----------------
LOBBY
QUESTION_ACTIVE
QUESTION_RESULT
LEADERBOARD
COMPLETED
```

```text
AskedQuestionStatus
-------------------
ACTIVE
COMPLETED
```

```text
AnswerStatus
------------
SUBMITTED
NOT_ATTEMPTED
```

```text
MediaStatus
-----------
PENDING
READY
DELETED
```

```text
MediaPurpose
------------
USER_AVATAR
PROJECT_COVER
QUIZ_COVER
QUESTION_IMAGE
```

Enums should be changed cautiously after production data exists.

---

# 6. User

Represents an authenticated account.

Suggested fields:

```text
User

id
name
email
passwordHash
avatarMediaId?
createdAt
updatedAt
```

Constraints:

```text
PRIMARY KEY (id)
UNIQUE (email)
```

Rules:

- Email should be normalized before persistence.
- Password hash is never returned from normal user queries.
- Real name is used for MVP leaderboard display.

Recommended indexes:

```text
UNIQUE INDEX users_email_unique ON users(email)
```

---

# 7. AuthSession

Stores revocable refresh/authentication sessions.

Suggested fields:

```text
AuthSession

id
userId
refreshTokenHash
createdAt
expiresAt
lastUsedAt?
revokedAt?
userAgent?
```

Relationships:

```text
AuthSession.userId
→ User.id
```

Constraints:

```text
UNIQUE (refreshTokenHash)
```

Indexes:

```text
(userId)
(expiresAt)
(refreshTokenHash)
```

Rules:

- Store only a secure hash/derived representation of refresh credentials.
- Revoked sessions remain invalid even if their original expiry has not passed.
- Access tokens may remain short-lived/stateless while refresh sessions are persisted here.

---

# 8. Project

A host-owned container for related quizzes.

Suggested fields:

```text
Project

id
ownerUserId
name
description?
coverMediaId?
createdAt
updatedAt
```

Relationships:

```text
ownerUserId
→ User.id
```

Indexes:

```text
(ownerUserId)
(ownerUserId, createdAt)
```

MVP ownership rule:

```text
One owner
```

Future co-hosting can introduce a ProjectMembership/ProjectRole model without changing Quiz ownership semantics dramatically.

---

# 9. ProjectAssociation

Represents a participant's association with a project after joining/registering for a quiz in that project.

Suggested fields:

```text
ProjectAssociation

id
projectId
userId
createdViaQuizId?
createdAt
```

Constraints:

```text
UNIQUE (projectId, userId)
```

Relationships:

```text
projectId → Project.id
userId → User.id
createdViaQuizId? → Quiz.id
```

Purpose:

- Populate future project quizzes on participant dashboard.
- Avoid modelling this as a social-following system in MVP.

Recommended behavior:

```text
Register for first quiz in project
        ↓
UPSERT ProjectAssociation
```

If participant later unregisters from the quiz, the project association remains.

A future explicit "Leave Project" feature may remove it.

---

# 10. Quiz

Represents a prepared quiz.

Suggested fields:

```text
Quiz

id
publicId
projectId
creatorUserId
title
description?
coverMediaId?
status
scheduledAt?
registrationLimit
defaultQuestionDurationSeconds
allowLateJoin
createdAt
updatedAt
publishedAt?
completedAt?
```

Constraints:

```text
UNIQUE (publicId)
CHECK registrationLimit > 0
CHECK defaultQuestionDurationSeconds > 0
```

Relationships:

```text
projectId → Project.id
creatorUserId → User.id
```

Indexes:

```text
(projectId)
(creatorUserId)
(status)
(scheduledAt)
(projectId, status)
(creatorUserId, status)
```

Rules:

- `creatorUserId` must own the parent project in MVP.
- `scheduledAt` may be null for immediately published quizzes.
- Schedule does not automatically start a quiz.
- Once quiz becomes live, question content should be immutable.

---

# 11. Public Quiz ID

Internal IDs should not be required in public URLs.

Example:

```text
/quiz/k7F9xP2mR4
```

`publicId` should be:

- sufficiently random,
- stable,
- unique,
- URL-safe.

It is not a security credential.

Authentication/registration rules still apply.

---

# 12. Question

Suggested fields:

```text
Question

id
quizId
type
text
imageMediaId?
position
durationOverrideSeconds?
createdAt
updatedAt
```

Relationships:

```text
quizId → Quiz.id
```

Constraints:

```text
UNIQUE (quizId, position)
CHECK position >= 0
CHECK durationOverrideSeconds IS NULL OR durationOverrideSeconds > 0
```

Indexes:

```text
(quizId, position)
```

Effective duration:

```text
Question.durationOverrideSeconds
        ??
Quiz.defaultQuestionDurationSeconds
```

---

# 13. QuestionOption

Used for:

```text
SINGLE_CHOICE
MULTIPLE_CHOICE
```

Suggested fields:

```text
QuestionOption

id
questionId
text
position
isCorrect
createdAt
updatedAt
```

Constraints:

```text
UNIQUE (questionId, position)
```

Relationships:

```text
questionId → Question.id
```

Indexes:

```text
(questionId, position)
```

Service-level rules:

### SINGLE_CHOICE

```text
At least 2 options
Exactly 1 correct option
```

### MULTIPLE_CHOICE

```text
At least 2 options
At least 1 correct option
```

### DESCRIPTIVE

```text
0 options
```

---

# 14. QuizRegistration

Represents a user's reserved participant slot.

Suggested fields:

```text
QuizRegistration

id
quizId
userId
status
registeredAt
cancelledAt?
```

Constraints:

```text
UNIQUE (quizId, userId)
```

Relationships:

```text
quizId → Quiz.id
userId → User.id
```

Indexes:

```text
(quizId, status)
(userId, status)
(userId, registeredAt)
```

Rules:

- User cannot hold multiple registrations for same quiz.
- Re-registering a cancelled registration should reactivate the existing record rather than create a duplicate row.
- Registration limit counts only rows with `REGISTERED`.

---

# 15. Registration Capacity Transaction

Capacity cannot rely on:

```text
SELECT count(...)
then
INSERT
```

without concurrency protection.

Recommended approach:

```text
BEGIN

Lock Quiz row FOR UPDATE

Read registrationLimit

Count active registrations

If count >= limit:
    reject

Create/reactivate registration

COMMIT
```

Redis may assist with fast UI counts, but PostgreSQL is the authority for capacity.

---

# 16. LiveQuizSession

Represents one live execution of a quiz.

Suggested fields:

```text
LiveQuizSession

id
quizId
hostUserId
state
startedAt?
endedAt?
currentAskedQuestionId?
createdAt
updatedAt
```

Relationships:

```text
quizId → Quiz.id
hostUserId → User.id
currentAskedQuestionId? → AskedQuestion.id
```

Indexes:

```text
(quizId)
(hostUserId)
(state)
(hostUserId, state)
```

The model can support more than one historical session per quiz in the future even if MVP generally runs a quiz once.

---

# 17. One Active Quiz Per Host

MVP rule:

```text
One host cannot run two live quizzes simultaneously.
```

Application service must check this.

Recommended PostgreSQL hardening:

Create a partial unique index conceptually equivalent to:

```sql
UNIQUE(host_user_id)
WHERE state IN (
  'LOBBY',
  'QUESTION_ACTIVE',
  'QUESTION_RESULT',
  'LEADERBOARD'
)
```

If Prisma cannot represent the partial index directly, create it through a SQL migration.

---

# 18. ParticipantSession

Represents that a registered user actually entered a particular live session.

Suggested fields:

```text
ParticipantSession

id
liveSessionId
userId
firstJoinedAt
lastJoinedAt
leftAt?
createdAt
updatedAt
```

Constraints:

```text
UNIQUE (liveSessionId, userId)
```

Relationships:

```text
liveSessionId → LiveQuizSession.id
userId → User.id
```

Purpose:

- Distinguish registered-but-never-attended users from actual participants.
- Determine who receives final results.
- Support late-join history.

Realtime socket connection/presence is not written here for every connection event. That belongs in Redis.

---

# 19. AskedQuestion

This is a critical entity.

A Question is prepared content.

An AskedQuestion means:

> This question was actually presented during this live session.

Suggested fields:

```text
AskedQuestion

id
liveSessionId
questionId
sequenceNumber
status
durationSeconds
startedAt
endsAt
completedAt?
createdAt
```

Constraints:

```text
UNIQUE (liveSessionId, questionId)
UNIQUE (liveSessionId, sequenceNumber)
CHECK durationSeconds > 0
CHECK sequenceNumber > 0
```

Relationships:

```text
liveSessionId → LiveQuizSession.id
questionId → Question.id
```

Indexes:

```text
(liveSessionId, sequenceNumber)
(liveSessionId, status)
(questionId)
```

Why this exists:

```text
Quiz contains 20 questions
Host asks only 12
Only those 12 AskedQuestion rows affect final scoring
```

---

# 20. Question Ordering

`Question.position` represents quiz-builder ordering.

`AskedQuestion.sequenceNumber` represents actual live order.

Example:

```text
Builder order:
Q1 Q2 Q3 Q4 Q5

Live order:
Q1 Q3 Q5 Q2
```

Unused Q4 has no AskedQuestion row.

---

# 21. AskedQuestion Snapshot Rules

For MVP, quiz/question editing becomes locked once the live session begins.

AskedQuestion can therefore reference the original Question while snapshotting execution-specific timing:

```text
durationSeconds
startedAt
endsAt
```

Future live editing may require full question snapshots. That is outside MVP.

---

# 22. AnswerSubmission

Stores the durable participant answer/result for one AskedQuestion.

Suggested fields:

```text
AnswerSubmission

id
askedQuestionId
userId
status
answerText?
submittedAt?
responseTimeMs?
isCorrect?
pointsAwarded
createdAt
```

Constraints:

```text
UNIQUE (askedQuestionId, userId)
CHECK pointsAwarded >= 0
```

Relationships:

```text
askedQuestionId → AskedQuestion.id
userId → User.id
```

Indexes:

```text
(askedQuestionId)
(userId)
(askedQuestionId, status)
(userId, createdAt)
```

---

# 23. AnswerSubmissionOption

Stores selected options for single/multiple choice answers.

Suggested fields:

```text
AnswerSubmissionOption

answerSubmissionId
questionOptionId
```

Primary/unique key:

```text
(answerSubmissionId, questionOptionId)
```

For single-choice:

```text
1 selected option
```

For multiple-choice:

```text
1..N selected options
```

For descriptive:

```text
0 selected options
```

---

# 24. Why Not Store Option IDs Only as JSON

JSONB would be possible, but a join table gives:

- stronger relational integrity,
- foreign keys,
- easier option-level reporting,
- cleaner future analytics.

For MVP scale, the additional rows are acceptable.

---

# 25. Answer Status Semantics

## SUBMITTED

Participant explicitly submitted before server expiry.

Possible:

```text
isCorrect = true/false
pointsAwarded >= 0
submittedAt != null
```

## NOT_ATTEMPTED

Participant had no accepted submission for that AskedQuestion.

Expected:

```text
isCorrect = null
pointsAwarded = 0
submittedAt = null
```

Not attempted remains distinct from incorrect.

---

# 26. Who Gets NOT_ATTEMPTED Rows

Final results apply to users who actually entered the live session.

Relevant population:

```text
ParticipantSession
```

not every registration.

Registered users who never enter the live session do not need a QuizResult in MVP.

---

# 27. Response Time

For scored answers:

```text
responseTimeMs =
submittedAt - AskedQuestion.startedAt
```

Do not trust response time supplied by the client.

The backend calculates it using authoritative server timestamps.

---

# 28. Points Persistence

`pointsAwarded` is persisted with the submission.

Why:

- historical score should not change if scoring code later changes,
- quiz history remains stable,
- leaderboard reconstruction becomes easy.

---

# 29. QuizResult

Finalized durable result for one participant.

Suggested fields:

```text
QuizResult

id
liveSessionId
userId
totalScore
rank
correctCount
incorrectCount
notAttemptedCount
finalizedAt
```

Constraints:

```text
UNIQUE (liveSessionId, userId)
CHECK totalScore >= 0
CHECK rank > 0
CHECK correctCount >= 0
CHECK incorrectCount >= 0
CHECK notAttemptedCount >= 0
```

Indexes:

```text
(liveSessionId, rank)
(userId, finalizedAt)
```

---

# 30. Final Score Derivation

Final score is based only on:

```text
AskedQuestion rows
```

Unused quiz questions have no AskedQuestion row and cannot influence:

- score,
- correct count,
- incorrect count,
- not-attempted count.

---

# 31. Shared Ranks

If two participants have exactly equal total scores, they share the same rank.

Example:

```text
Score 8420 → Rank 1
Score 8420 → Rank 1
Score 8310 → Rank 3
```

Equivalent to SQL ranking semantics:

```text
RANK()
```

rather than `ROW_NUMBER()`.

---

# 32. MediaAsset

Tracks objects stored in Supabase Storage.

Suggested fields:

```text
MediaAsset

id
ownerUserId
purpose
status
bucket
objectPath
fileName
mimeType
sizeBytes
createdAt
readyAt?
deletedAt?
```

Constraints:

```text
UNIQUE (bucket, objectPath)
CHECK sizeBytes >= 0
```

Referenced from:

```text
User.avatarMediaId
Project.coverMediaId
Quiz.coverMediaId
Question.imageMediaId
```

---

# 33. Media Upload Lifecycle

```text
PENDING
   ↓
Browser Upload
   ↓
Backend Confirmation
   ↓
READY
```

Failed/unconfirmed objects can be cleaned later.

---

# 34. Suggested Delete Behavior

- Draft quizzes may be hard deleted.
- Completed quizzes should not be hard deleted through normal MVP UI.
- Questions may be deleted while quiz remains editable.
- Questions cannot be deleted after live session starts.
- Competitive answers/results should not be individually deletable through normal user actions.

---

# 35. Prisma Modelling Direction

Conceptually:

```text
User
  1 ── * Project
  1 ── * AuthSession
  1 ── * QuizRegistration
  1 ── * ParticipantSession
  1 ── * AnswerSubmission
  1 ── * QuizResult

Project
  1 ── * Quiz

Quiz
  1 ── * Question
  1 ── * QuizRegistration
  1 ── * LiveQuizSession

Question
  1 ── * QuestionOption
  1 ── * AskedQuestion

LiveQuizSession
  1 ── * AskedQuestion
  1 ── * ParticipantSession
  1 ── * QuizResult

AskedQuestion
  1 ── * AnswerSubmission

AnswerSubmission
  1 ── * AnswerSubmissionOption
```

---

# 36. Important Database Constraints Summary

Required hard constraints:

```text
User.email UNIQUE
Quiz.publicId UNIQUE
ProjectAssociation(projectId, userId) UNIQUE
Question(quizId, position) UNIQUE
QuestionOption(questionId, position) UNIQUE
QuizRegistration(quizId, userId) UNIQUE
ParticipantSession(liveSessionId, userId) UNIQUE
AskedQuestion(liveSessionId, questionId) UNIQUE
AskedQuestion(liveSessionId, sequenceNumber) UNIQUE
AnswerSubmission(askedQuestionId, userId) UNIQUE
AnswerSubmissionOption(answerSubmissionId, questionOptionId) UNIQUE
QuizResult(liveSessionId, userId) UNIQUE
```

Recommended additional invariant:

```text
One active LiveQuizSession per host
```

through a PostgreSQL partial unique index.

---

# 37. Transaction Boundaries

## Register Participant

```text
Lock quiz/capacity
Validate status
Validate capacity
Create/reactivate registration
Create project association if needed
Commit
```

## Start Quiz

```text
Validate creator
Validate no other active host session
Create/activate LiveQuizSession
Update Quiz state
Commit
```

## Start Question

```text
Validate session state
Validate question unused
Create AskedQuestion
Update LiveQuizSession currentAskedQuestionId/state
Commit

Then initialize Redis + broadcast
```

## Submit Answer

```text
Validate active question/time
Create AnswerSubmission
Create selected option rows
Persist points/correctness
Commit

Then update Redis aggregates
```

## Complete Quiz

```text
Finalize missing NOT_ATTEMPTED data
Calculate final results
Insert/upsert QuizResult rows
Update LiveQuizSession
Update Quiz status
Commit

Then update Redis + broadcast
```

---

# 38. Redis Design Principles

Redis is optimized for:

- ephemeral live state,
- fast counters,
- sorted ranking,
- presence,
- rate limiting,
- cross-instance coordination.

Redis should not duplicate the entire PostgreSQL database.

---

# 39. Redis Key Naming Convention

Recommended prefix:

```text
lq:
```

Meaning:

```text
live quiz
```

Structure:

```text
lq:{liveSessionId}:...
```

Other prefixes:

```text
rate:
lock:
```

---

# 40. Live Session State Key

Key:

```text
lq:{sessionId}:state
```

Type:

```text
HASH
```

Suggested fields:

```text
quizId
hostUserId
state
currentAskedQuestionId
allowLateJoin
startedAt
updatedAt
```

---

# 41. Active Question Key

Key:

```text
lq:{sessionId}:question:{askedQuestionId}
```

Type:

```text
HASH
```

Suggested fields:

```text
questionId
status
startedAtMs
endsAtMs
durationMs
questionType
submittedCount
```

Correct-answer data must never be exposed directly to participant payloads.

---

# 42. Presence Key

Recommended key:

```text
lq:{sessionId}:connections
```

Type:

```text
HASH
```

Mapping:

```text
userId → connection metadata
```

Possible metadata:

```text
socketId
connectedAt
lastSeenAt
clientSessionId
```

---

# 43. One Active Device State

Key:

```text
lq:{sessionId}:user:{userId}:active-socket
```

Type:

```text
STRING
```

Value:

```text
socketId
```

Newest valid connection replaces the previous active connection.

---

# 44. Presence TTL

Recommended active socket TTL:

```text
~60–120 seconds
```

refreshed through connection lifecycle/heartbeat activity.

Presence is best-effort realtime state.

Historical attendance remains in PostgreSQL ParticipantSession.

---

# 45. Distribution Key

For MCQ:

```text
lq:{sessionId}:distribution:{askedQuestionId}
```

Type:

```text
HASH
```

Fields:

```text
option:{optionId} → count
submittedCount → count
```

Use atomic increments after accepted durable submissions.

---

# 46. Multiple-Choice Distribution

One multiple-choice submission can increment multiple option counters.

Example:

```text
User selects A + C

INCR A
INCR C
INCR submittedCount once
```

Percentages therefore do not necessarily sum to 100%.

---

# 47. Descriptive Response Realtime State

Descriptive response text remains durable in PostgreSQL.

For realtime host rendering, broadcast the response after persistence.

A Redis list is not required in MVP.

On host reconnect, current descriptive submissions can be loaded from PostgreSQL.

---

# 48. Live Leaderboard Key

Key:

```text
lq:{sessionId}:leaderboard
```

Type:

```text
SORTED SET
```

Mapping:

```text
member = userId
score = totalScore
```

On accepted scored answer:

```text
ZINCRBY
```

---

# 49. Leaderboard Names

Redis stores participant identity using `userId`, not mutable name strings as authority.

Names can be fetched/cached from PostgreSQL when rendering.

---

# 50. Top 10 Query

Conceptually:

```text
ZREVRANGE leaderboard 0 9 WITHSCORES
```

The backend must still calculate shared rank numbers correctly for equal scores.

---

# 51. Personal Rank

For participant personal rank:

1. Get participant score.
2. Count members with strictly greater score.
3. Rank = greaterCount + 1.

This naturally creates shared ranks.

---

# 52. Rate Limit Keys

Pattern:

```text
rate:{scope}:{identifier}:{window}
```

Examples:

```text
rate:login:ip:...
rate:submit-answer:user:...
rate:register:user:...
```

Use counters with TTL.

Exact quotas belong in Security Design.

---

# 53. Distributed Lock Keys

Pattern:

```text
lock:{operation}:{resourceId}
```

Examples:

```text
lock:session-transition:{sessionId}
lock:quiz-complete:{sessionId}
lock:start-question:{sessionId}
```

Locks should:

- use random lock ownership values,
- have short expiries,
- be released only by their owner.

Database constraints/transactions remain the final integrity layer.

---

# 54. Redis TTL Strategy

## Active Live State

Use a long safety TTL refreshed on state changes, such as:

```text
24 hours
```

Do not use a short TTL that can expire mid-quiz.

## After Completion

Set expiry such as:

```text
6–24 hours
```

for state, distribution, leaderboard and other live keys.

## Presence

```text
60–120 seconds
```

## Locks

```text
5–15 seconds
```

## Rate Limits

TTL equals the rate-limit window.

---

# 55. Redis Recovery Principle

Redis is disposable.

If Redis loses live-state keys, important state should be reconstructable from PostgreSQL.

Recoverable:

```text
Live session
Current AskedQuestion
startedAt
endsAt
Accepted answers
Scores
Leaderboard
Distribution counts
```

Presence rebuilds as clients reconnect.

---

# 56. Live State Rehydration

If live state is missing:

```text
Load LiveQuizSession
        ↓
Load current AskedQuestion
        ↓
Load submissions
        ↓
Recalculate distribution
        ↓
Recalculate participant scores
        ↓
Rebuild Redis leaderboard
        ↓
Rebuild session state
```

Use a short distributed lock to avoid duplicate rehydration.

---

# 57. Redis Update Ordering After Answer Persistence

Correct order:

```text
Validate
   ↓
Persist Answer in PostgreSQL
   ↓
Commit
   ↓
Update Redis counters
   ↓
Update Redis leaderboard
   ↓
Broadcast
```

Database first prevents Redis from containing an answer that failed durable persistence.

---

# 58. Redis Failure After DB Commit

If PostgreSQL commit succeeds but Redis update fails:

- the answer remains valid,
- log the Redis failure,
- acknowledge durable acceptance appropriately,
- rebuild/reconcile Redis from PostgreSQL,
- never create a duplicate database answer.

---

# 59. Socket.IO Architecture

Recommended namespace:

```text
/quiz
```

One namespace is sufficient for MVP.

Rooms provide quiz isolation.

---

# 60. Socket Rooms

Primary room:

```text
quiz:{liveSessionId}
```

Additional rooms:

```text
quiz:{liveSessionId}:host
quiz:{liveSessionId}:participants
```

Host joins:

```text
quiz:123
quiz:123:host
```

Participant joins:

```text
quiz:123
quiz:123:participants
```

---

# 61. Socket Authentication

Authentication occurs during handshake.

Conceptually:

```text
Client connects /quiz
        ↓
Provide auth credentials
        ↓
Backend validates
        ↓
socket.data.userId = authenticated user
```

Never trust `userId` sent in an event payload as identity.

---

# 62. Joining a Live Session

Client event:

```text
session:join
```

Input:

```json
{
  "liveSessionId": "..."
}
```

Server validates:

1. Authenticated user.
2. Session exists.
3. Registration exists and is active.
4. Late joining rules.
5. Session not completed.
6. One-device policy.

Then:

```text
UPSERT ParticipantSession
Join Socket.IO rooms
Store Redis presence
Return authoritative session snapshot
```

---

# 63. Session Join Acknowledgement

Success:

```json
{
  "ok": true,
  "session": {
    "id": "...",
    "state": "QUESTION_ACTIVE",
    "allowLateJoin": true
  },
  "snapshot": {}
}
```

Failure example:

```json
{
  "ok": false,
  "error": {
    "code": "LATE_JOIN_DISABLED",
    "message": "Joining is currently closed."
  }
}
```

---

# 64. Session Snapshot

Snapshot must be role-aware.

Participant snapshot may contain:

```text
liveSessionId
quiz title
state
current question public data
startedAt
endsAt
participant submission status
participant current score
participant current rank
leaderboard only if currently globally visible
```

Host snapshot may additionally contain:

```text
correct answer
live distribution
connected count
submitted count
top leaderboard
unanswered questions available to select
```

Never send host-only data to participant clients.

---

# 65. Client-to-Server Socket Events

Recommended MVP event set:

```text
session:join
session:leave
answer:submit
host:quiz-start
host:question-start
host:leaderboard-show
host:leaderboard-hide
host:late-join-set
host:quiz-end
session:sync
```

---

# 66. Server-to-Client Socket Events

Recommended events:

```text
session:snapshot
quiz:started
question:started
answer:accepted
question:ended
question:result
leaderboard:shown
leaderboard:hidden
quiz:ended
session:replaced
session:error
```

Host-only events:

```text
host:presence-updated
host:distribution-updated
host:descriptive-response-added
```

---

# 67. `host:quiz-start`

Payload:

```json
{
  "liveSessionId": "..."
}
```

Server:

1. Authenticate.
2. Verify creator.
3. Verify valid state.
4. Transition quiz/session.
5. Initialize Redis state.
6. Broadcast `quiz:started`.

---

# 68. `host:question-start`

Payload:

```json
{
  "liveSessionId": "...",
  "questionId": "..."
}
```

Server validates:

- host ownership,
- session state,
- question belongs to quiz,
- question has not already been asked.

Then:

```text
Create AskedQuestion
Persist timing
Update Redis
Schedule expiry
Broadcast question:started
```

---

# 69. Participant `question:started` Payload

Example:

```json
{
  "askedQuestionId": "...",
  "question": {
    "id": "...",
    "type": "SINGLE_CHOICE",
    "text": "Which option is correct?",
    "imageUrl": null,
    "options": [
      { "id": "a", "text": "A" },
      { "id": "b", "text": "B" }
    ]
  },
  "startedAt": "2026-09-23T15:00:00.000Z",
  "endsAt": "2026-09-23T15:00:20.000Z"
}
```

Must not include:

```text
isCorrect
correctOptionIds
live distribution
```

---

# 70. Host `question:started` Data

Host may receive additional host-only data including:

```text
correctOptionIds
current submitted count
current distribution
```

Send this only to the host room.

---

# 71. `answer:submit`

Single choice example:

```json
{
  "liveSessionId": "...",
  "askedQuestionId": "...",
  "clientRequestId": "...",
  "selectedOptionIds": ["..."]
}
```

Multiple choice:

```json
{
  "liveSessionId": "...",
  "askedQuestionId": "...",
  "clientRequestId": "...",
  "selectedOptionIds": ["...", "..."]
}
```

Descriptive:

```json
{
  "liveSessionId": "...",
  "askedQuestionId": "...",
  "clientRequestId": "...",
  "answerText": "..."
}
```

Do not accept authoritative values for:

```text
points
isCorrect
responseTime
userId
```

---

# 72. Answer Submission Server Flow

```text
answer:submit
     ↓
Authenticated socket
     ↓
Validate session
     ↓
Validate participant membership
     ↓
Validate current AskedQuestion
     ↓
Check server time < endsAt
     ↓
Check no existing submission
     ↓
Validate option IDs/text
     ↓
Calculate correctness
     ↓
Calculate server responseTimeMs
     ↓
Calculate points
     ↓
DB transaction
     ↓
Redis update
     ↓
Host realtime updates
     ↓
Acknowledge participant
```

---

# 73. `answer:submit` Acknowledgement

While question is active, acknowledgement must not reveal correctness or points.

Example:

```json
{
  "ok": true,
  "submissionId": "...",
  "acceptedAt": "2026-09-23T15:00:08.200Z"
}
```

Correctness and points become participant-visible after expiry.

---

# 74. Client Request IDs

`clientRequestId` helps with network retries and UX.

Database uniqueness remains the real hard protection:

```text
(askedQuestionId, userId)
```

---

# 75. Host Distribution Update

Event:

```text
host:distribution-updated
```

Example:

```json
{
  "askedQuestionId": "...",
  "submittedCount": 217,
  "optionCounts": {
    "option-a": 91,
    "option-b": 72,
    "option-c": 54
  }
}
```

Counts are generally more reusable than sending only percentages.

---

# 76. Distribution Broadcast Throttling

Do not necessarily broadcast on every answer.

Recommended:

```text
Every accepted answer
→ Redis counters update immediately

Host updates
→ coalesced approximately every 100–500 ms
```

Exact interval must be load-tested.

---

# 77. Descriptive Response Event

After durable descriptive submission:

```text
host:descriptive-response-added
```

Example:

```json
{
  "askedQuestionId": "...",
  "responseId": "...",
  "text": "Customer retention reduces acquisition dependency."
}
```

Participant identity is intentionally omitted from the live host presentation payload.

---

# 78. Question Expiry Authority

Question expiry is determined exclusively by:

```text
AskedQuestion.endsAt
```

Client countdown reaching zero is UI behavior only.

Server rejects answers at or after authoritative expiry.

---

# 79. Question Expiry Trigger

Primary trigger:

```text
Backend schedules a timer when question starts.
```

At expiry:

```text
Acquire transition lock
      ↓
Re-read authoritative state/time
      ↓
Finalize question once
```

Runtime timers are not the only safeguard.

---

# 80. Question Expiry Fallback

Every relevant interaction should run an equivalent of:

```text
ensureLiveSessionCurrent()
```

If state says `QUESTION_ACTIVE` but server time is beyond `endsAt`, backend finalizes before continuing.

Apply on:

- answer submission,
- host actions,
- participant sync,
- reconnect,
- session snapshot.

---

# 81. Atomic Question Finalization

Protect with:

```text
Redis distributed transition lock
+
PostgreSQL state check
```

Conceptually:

```text
Acquire lock
Read AskedQuestion status

If already COMPLETED:
    return existing result

Else:
    mark completed
    update LiveQuizSession state
    reconcile aggregates
    commit

Update Redis
Broadcast
Release lock
```

---

# 82. NOT_ATTEMPTED Finalization

Two possible strategies:

## Eager

At question close create rows for all eligible participants with no answer.

## Lazy

At quiz completion derive/materialize missing attempts.

Recommended MVP:

```text
Lazy/finalization
```

because it keeps realtime question closure lightweight.

---

# 83. `question:ended`

Server broadcasts when active question closes.

Example:

```json
{
  "askedQuestionId": "...",
  "endedAt": "..."
}
```

Detailed participant-specific result follows through `question:result`.

---

# 84. Participant `question:result`

Example:

```json
{
  "askedQuestionId": "...",
  "status": "SUBMITTED",
  "selectedOptionIds": ["..."],
  "correctOptionIds": ["..."],
  "isCorrect": true,
  "pointsAwarded": 742,
  "totalScore": 4280,
  "rank": 47,
  "participantCount": 600,
  "finalDistribution": {
    "option-a": 112,
    "option-b": 288,
    "option-c": 200
  }
}
```

NOT_ATTEMPTED example:

```json
{
  "status": "NOT_ATTEMPTED",
  "pointsAwarded": 0
}
```

Descriptive questions have no correct answer and award zero points.

---

# 85. Participant Distribution Privacy

Before expiry, participants must not obtain live distribution through:

- Socket events,
- REST endpoints,
- hidden component props,
- preloaded server data.

This is a backend contract rule, not merely a UI rule.

---

# 86. `host:leaderboard-show`

Payload:

```json
{
  "liveSessionId": "...",
  "audience": "PARTICIPANTS"
}
```

Server:

1. Authorize host.
2. Validate state.
3. Read Top 10.
4. Update Redis state to LEADERBOARD.
5. Broadcast `leaderboard:shown`.

---

# 87. Host-Private Leaderboard

Private host viewing must not switch participant presentation state.

Host can read leaderboard through a host-only request/event or REST query.

---

# 88. `leaderboard:shown`

Participant payload:

```json
{
  "top": [
    {
      "rank": 1,
      "name": "Rahul",
      "score": 8420
    }
  ]
}
```

Only Top 10 is required.

---

# 89. `host:leaderboard-hide`

Returns participant presentation from:

```text
LEADERBOARD
```

to:

```text
QUESTION_RESULT
```

The prior result remains reconstructable.

---

# 90. Starting Next Question from Leaderboard

Valid transition:

```text
LEADERBOARD
    ↓
QUESTION_ACTIVE
```

No explicit hide operation is required before starting the next question.

---

# 91. `host:late-join-set`

Payload:

```json
{
  "liveSessionId": "...",
  "allow": false
}
```

Server authorizes host and updates current runtime state.

Persist runtime value so reconnect/recovery does not lose the setting.

---

# 92. `host:quiz-end`

Flow:

```text
Authorize host
      ↓
Acquire completion lock
      ↓
Finalize active question if necessary
      ↓
Generate final participant stats
      ↓
Persist QuizResults
      ↓
Mark session COMPLETED
      ↓
Mark Quiz COMPLETED
      ↓
Update Redis
      ↓
Broadcast quiz:ended
```

Calling this twice must remain idempotent.

---

# 93. `quiz:ended`

Participant-safe payload may include:

```json
{
  "liveSessionId": "...",
  "finalScore": 8420,
  "finalRank": 4,
  "correctCount": 8,
  "incorrectCount": 2,
  "notAttemptedCount": 1
}
```

Final Top 10 is not automatically shown unless host chooses to reveal it.

---

# 94. Reconnection Flow

```text
Socket disconnects
       ↓
Socket.IO reconnects
       ↓
Authenticate
       ↓
session:join / session:sync
       ↓
Backend validates
       ↓
Check authoritative state
       ↓
Return session snapshot
```

Client rebuilds the screen from the snapshot.

---

# 95. `session:sync`

Use after:

- reconnect,
- browser focus,
- suspected stale state,
- host reconnect.

Payload:

```json
{
  "liveSessionId": "..."
}
```

Response returns role-specific authoritative snapshot.

---

# 96. Reconnect During Active Question

Snapshot contains:

```text
state = QUESTION_ACTIVE
endsAt
current question
submission status
```

If time remains and participant has no submission, answering remains available.

If already submitted, answer remains locked.

If expiry passed, backend finalizes/synchronizes before returning snapshot.

---

# 97. Host Reconnect

Host reconnect does not create a new session.

```text
Host authenticates
       ↓
Resolve existing active LiveQuizSession
       ↓
Join host room
       ↓
Rehydrate/sync Redis if needed
       ↓
Return host snapshot
```

---

# 98. Session Replacement

When a participant connects from a second device:

```text
Newest valid socket becomes authoritative.
```

Old socket receives:

```text
session:replaced
```

and loses permission to submit.

---

# 99. Socket Disconnect

On disconnect:

```text
Remove/expire socket presence
```

Do not:

- unregister participant,
- delete ParticipantSession,
- delete answer,
- reset score.

---

# 100. Socket Error Contract

Suggested structure:

```json
{
  "code": "QUESTION_CLOSED",
  "message": "This question is no longer accepting answers.",
  "requestId": "..."
}
```

Common realtime errors:

```text
UNAUTHENTICATED
FORBIDDEN
SESSION_NOT_FOUND
REGISTRATION_REQUIRED
LATE_JOIN_DISABLED
QUIZ_NOT_LIVE
INVALID_STATE_TRANSITION
QUESTION_NOT_FOUND
QUESTION_ALREADY_ASKED
QUESTION_CLOSED
ALREADY_SUBMITTED
INVALID_ANSWER
SESSION_REPLACED
RATE_LIMITED
INTERNAL_ERROR
```

---

# 101. Socket Acknowledgement Rule

Mutating client-originated commands should use acknowledgements:

```text
session:join
answer:submit
host:quiz-start
host:question-start
host:leaderboard-show
host:late-join-set
host:quiz-end
```

Do not rely only on later broadcast to tell the initiating client whether a command succeeded.

---

# 102. REST vs Socket Responsibility

Use REST for:

```text
Signup/login
Create/edit project
Create/edit quiz
Create/edit questions
Publish/schedule quiz
Register/unregister
Load dashboard
Load history
Load completed results
Create storage upload permission
```

Use Socket.IO for:

```text
Live session join
Host live controls
Question delivery
Answer submission
Live distribution
Realtime result state
Leaderboard presentation
Live reconnection/sync
```

---

# 103. Data Consistency Matrix

| Concern | PostgreSQL | Redis | Socket.IO |
|---|---|---|---|
| User | Authoritative | No | No |
| Project | Authoritative | No | No |
| Quiz definition | Authoritative | Minimal runtime ref | No |
| Registration | Authoritative | Optional count cache | Notification only |
| Live session | Durable identity/state | Operational state | Transport |
| Active question timing | Durable AskedQuestion | Fast active state | Broadcast |
| Answer | Authoritative | Aggregates/cache | Submission transport |
| Correctness | Authoritative | Optional cache | Result transport |
| Score | Authoritative per answer | Live total cache | Result transport |
| Distribution | Reconstructable | Primary live counters | Host/final transport |
| Leaderboard | Reconstructable | Primary live ranking | Presentation |
| Presence | Participant history only | Authoritative live presence | Connection layer |
| Final result | Authoritative | Temporary cache | Final transport |

---

# 104. Database Recovery of Live Leaderboard

If Redis leaderboard disappears:

```text
Find all AnswerSubmissions
for AskedQuestions in live session

Group by user

SUM(pointsAwarded)

Rebuild sorted set
```

---

# 105. Database Recovery of Distribution

For current AskedQuestion:

```text
Load submitted answers
      ↓
Load AnswerSubmissionOption rows
      ↓
COUNT by QuestionOption
      ↓
Rebuild Redis distribution hash
```

---

# 106. Race: Duplicate Answer Submission

Protection:

```text
DB UNIQUE (askedQuestionId, userId)
```

Only the transaction that actually creates the answer may update Redis counters/leaderboard.

Never award points twice.

---

# 107. Race: Question Ends During Submission

If the request reaches the server at or after `endsAt`:

```text
Rejected
```

Client timestamps do not extend eligibility.

---

# 108. Race: Host Starts Two Questions

Protection:

```text
Session transition lock
+
PostgreSQL state validation
+
AskedQuestion uniqueness
```

Only one question becomes active.

---

# 109. Race: Quiz End vs Answer Submission

Recommended order:

```text
host:quiz-end
      ↓
Acquire completion lock
      ↓
Close/finalize current question at server current time
      ↓
Reject later submissions
      ↓
Finalize results
```

---

# 110. Race: New Device vs Old Device Submission

Before accepting `answer:submit`, backend verifies current socket is the authoritative active socket for that user/session.

Old device receives:

```text
SESSION_REPLACED
```

---

# 111. Query Patterns to Optimize

Expected common queries:

```text
Host: projects by owner
Host: quizzes by project + status
Participant: registered upcoming quizzes
Participant: active/live registered quizzes
Participant: completed results by user
Quiz: questions ordered by position
Lobby: registration count
Live: AskedQuestions ordered by sequence
Submission: answer by askedQuestion + user
Finalization: submissions by live session
Host results: QuizResults ordered by rank
```

---

# 112. Suggested Database Index Summary

```text
User
- UNIQUE(email)

AuthSession
- userId
- expiresAt
- UNIQUE(refreshTokenHash)

Project
- ownerUserId
- ownerUserId + createdAt

ProjectAssociation
- UNIQUE(projectId, userId)
- userId

Quiz
- UNIQUE(publicId)
- projectId
- creatorUserId
- status
- scheduledAt
- projectId + status
- creatorUserId + status

Question
- UNIQUE(quizId, position)

QuestionOption
- UNIQUE(questionId, position)

QuizRegistration
- UNIQUE(quizId, userId)
- quizId + status
- userId + status

LiveQuizSession
- quizId
- hostUserId
- state
- partial UNIQUE active host

ParticipantSession
- UNIQUE(liveSessionId, userId)

AskedQuestion
- UNIQUE(liveSessionId, questionId)
- UNIQUE(liveSessionId, sequenceNumber)
- liveSessionId + status

AnswerSubmission
- UNIQUE(askedQuestionId, userId)

AnswerSubmissionOption
- PRIMARY/UNIQUE(answerSubmissionId, questionOptionId)

QuizResult
- UNIQUE(liveSessionId, userId)
- liveSessionId + rank
- userId + finalizedAt

MediaAsset
- UNIQUE(bucket, objectPath)
- ownerUserId
- status
```

---

# 113. Data Retention

MVP permanent records remain until a future deletion/retention policy is defined.

Redis live state expires after completion.

Logs must not retain secrets.

---

# 114. Personally Identifiable Information

MVP stores limited account data:

```text
name
email
passwordHash
```

Leaderboard exposes real name as agreed.

Do not include email in:

- socket broadcasts,
- leaderboards,
- public result payloads.

---

# 115. Database Seed Data

Development seed should support:

```text
1 host
1 participant
1 project
1 quiz
Single-choice question
Multiple-choice question
Descriptive question
```

Optional load-test seed:

```text
500 participant accounts/registrations
```

Production must never run destructive development seed logic.

---

# 116. Prisma Migration Rules

Use committed Prisma migrations.

Workflow:

```text
Edit Prisma schema
      ↓
Generate migration
      ↓
Review SQL
      ↓
Apply locally
      ↓
Test
      ↓
Apply through production deployment process
```

Custom SQL may be required for partial unique indexes and special PostgreSQL constraints.

---

# 117. Realtime Load Target

Initial design target:

```text
500 concurrent participants
per live quiz
```

Load test:

```text
500 socket joins
500 answer submissions in a burst
Distribution updates
Leaderboard updates
Question result broadcast
Reconnect burst
```

Measured tests determine actual supported concurrency.

---

# 118. Upstash Command Awareness

Redis free-tier usage should remain efficient.

Avoid:

- excessive per-second polling,
- overly frequent heartbeat writes,
- redundant GETs,
- unthrottled host broadcasts.

Use:

- pipelining where useful,
- atomic increments,
- sorted sets,
- coalesced host updates,
- reasonable presence intervals.

---

# 119. Realtime State Ownership Rule

There must be exactly one authoritative live-session stage:

```text
LOBBY
QUESTION_ACTIVE
QUESTION_RESULT
LEADERBOARD
COMPLETED
```

Redis contains the fast operational copy.

PostgreSQL contains enough durable session data to recover.

Socket clients consume state but never independently transition the room.

---

# 120. Important Design Decisions

## DDR-01: PostgreSQL for Durable Data

**Decision:** Permanent product and competitive records live in PostgreSQL.

**Reason:** Strong relational integrity, transactions, constraints and historical consistency.

## DDR-02: Redis for Live Operational State

**Decision:** Redis stores presence, active state, live distribution, leaderboard cache, rate limits and coordination.

**Reason:** These operations are frequent, temporary and latency-sensitive.

## DDR-03: Socket.IO for Realtime Transport

**Decision:** Live quiz commands/events use Socket.IO.

**Reason:** Rooms, reconnect support, acknowledgements and connection lifecycle fit the product.

## DDR-04: Separate AskedQuestion Entity

**Decision:** Prepared Questions and AskedQuestions are separate concepts.

**Reason:** Host may ask only a subset and in arbitrary order.

## DDR-05: One Submission per Asked Question

**Decision:** Database uniqueness prevents duplicate answers.

**Reason:** Competitive integrity must not rely only on UI locking.

## DDR-06: Server Time is Authoritative

**Decision:** Server timestamps determine answer eligibility.

**Reason:** Prevent client clock manipulation.

## DDR-07: Persist Awarded Points

**Decision:** Store points on AnswerSubmission.

**Reason:** Historical results remain stable if scoring implementation changes.

## DDR-08: Redis Leaderboard is Rebuildable

**Decision:** Live leaderboard uses Redis, but permanent score data remains in PostgreSQL.

**Reason:** Redis loss must not destroy final results.

## DDR-09: Lazy NOT_ATTEMPTED Materialization

**Decision:** Finalize missing attempts at quiz completion rather than mandatory mass inserts at every timeout.

**Reason:** Keep realtime question transitions lightweight.

## DDR-10: Host and Participant Payloads Differ

**Decision:** Socket payloads are role-aware.

**Reason:** Correct answers and live distributions must not leak to participants.

## DDR-11: Newest Device Wins

**Decision:** One active participant socket per user/live session; newest valid connection replaces previous one.

**Reason:** Enforce one active participation session.

## DDR-12: Question Expiry Has Timer + Recovery Path

**Decision:** Use runtime timer for immediate UX plus server-time reconciliation as fallback.

**Reason:** Instance restart must not leave a question permanently active.

---

# 121. Explicitly Deferred

This design does not implement:

- Team scoring
- Spectator connections
- Co-host socket permissions
- AI grading
- Manual descriptive grading
- Custom scoring formulas
- Question replay
- Live question editing
- Kafka
- RabbitMQ
- BullMQ
- Dedicated realtime microservice
- Dedicated presence service
- Separate leaderboard service
- Event sourcing
- CQRS
- Analytics warehouse
- Advanced anti-cheating
- Cross-region active-active realtime

---

# 122. Definition of Done

This database/realtime design is correctly implemented when:

- PostgreSQL contains all durable product facts.
- Redis can be lost without permanently losing scores/results.
- Registration cannot exceed capacity under concurrency.
- Only one active quiz per host exists.
- A participant has only one durable participation record per live session.
- A question can be asked at most once per live session.
- A participant can submit at most once per AskedQuestion.
- Client cannot control timestamps, correctness or points.
- Correct answers are not sent to participants early.
- Live distribution is host-only until expiry.
- Redis distribution can be reconstructed from PostgreSQL.
- Redis leaderboard can be reconstructed from PostgreSQL.
- Socket reconnect restores authoritative state.
- Old participant device is replaced by newest valid device.
- Question expiry still resolves after runtime interruption.
- Final results use only AskedQuestion records.
- Exact score ties produce shared ranks.
- Quiz completion is idempotent.
- Final QuizResult rows are durable and queryable without Redis.
- 500-participant load tests are executed before claiming target capacity.

---

**End of Database, Redis & Socket.IO Design Document**
