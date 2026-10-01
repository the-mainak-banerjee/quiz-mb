# Live Quiz Platform
## API Design Document

**Version:** V1  
**Status:** MVP API Contract Baseline  
**Parent Documents:**  
- Product Requirements Document  
- System Design Architecture Document  
- Database, Redis & Socket.IO Design Document  

**Backend:** Express + TypeScript  
**API Style:** REST + Socket.IO  
**Validation:** Zod  
**Authentication:** Custom access + refresh token model  
**Database:** PostgreSQL on Supabase  
**Realtime:** Socket.IO + Upstash Redis  

---

# 1. Purpose

This document defines the API contracts for the **Live Quiz Platform**.

It covers:

- REST API conventions
- Base paths
- Authentication
- Authorization
- Request validation
- Success responses
- Error responses
- Pagination
- Project APIs
- Quiz APIs
- Question APIs
- Registration APIs
- Dashboard APIs
- Live-session APIs
- Result APIs
- Media upload APIs
- Socket.IO namespaces
- Socket.IO rooms
- Socket event payloads
- Socket acknowledgements
- Reconnection/state synchronization
- Host-only realtime actions
- Participant-only realtime payload restrictions

This document defines **contracts**, not implementation internals.

---

# 2. API Principles

## 2.1 REST for Durable Business Operations

Use REST for:

- Authentication
- Profile
- Projects
- Quiz creation/editing
- Question management
- Quiz publishing and planned date/time metadata
- Registration
- Dashboard reads
- Quiz history
- Completed results
- Media upload permissions

## 2.2 Socket.IO for Live Session Operations

Use Socket.IO for:

- Joining a live room
- Live state synchronization
- Starting the quiz
- Starting questions
- Answer submission
- Host live distribution
- Question results
- Leaderboard presentation
- Late-join controls
- Ending the quiz
- Reconnection

## 2.3 Server is Authoritative

Clients must never submit authoritative values for:

```text
userId
isCorrect
points
rank
responseTime
questionEndTime
quiz state
registration capacity
```

The server derives all of these.

---

# 3. Base URLs

Recommended API base:

```text
/api
```

Examples:

```text
POST /api/auth/signup
GET /api/projects
POST /api/quizzes/:quizId/register
```

Socket namespace:

```text
/quiz
```

---

# 4. Standard REST Response Format

## Success

```json
{
  "success": true,
  "data": {}
}
```

With pagination:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "nextCursor": "..."
  }
}
```

## Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request is invalid.",
    "details": {},
    "requestId": "req_..."
  }
}
```

Never expose stack traces.

---

# 5. Common Error Codes

```text
VALIDATION_ERROR
UNAUTHENTICATED
TOKEN_EXPIRED
INVALID_REFRESH_TOKEN
FORBIDDEN
NOT_FOUND
CONFLICT
RATE_LIMITED
QUIZ_FULL
QUIZ_NOT_OPEN
QUIZ_NOT_LIVE
QUIZ_COMPLETED
REGISTRATION_REQUIRED
ALREADY_REGISTERED
NOT_REGISTERED
LATE_JOIN_DISABLED
QUESTION_CLOSED
QUESTION_ALREADY_ASKED
ALREADY_SUBMITTED
INVALID_ANSWER
INVALID_STATE_TRANSITION
SESSION_REPLACED
UPLOAD_NOT_ALLOWED
INTERNAL_ERROR
```

Recommended HTTP mapping:

```text
VALIDATION_ERROR → 422
UNAUTHENTICATED → 401
FORBIDDEN → 403
NOT_FOUND → 404
CONFLICT → 409
QUIZ_FULL → 409
RATE_LIMITED → 429
INTERNAL_ERROR → 500
```

---

# 6. Authentication API

## 6.1 Signup

```http
POST /api/auth/signup
```

Request:

```json
{
  "name": "Mainak Banerjee",
  "email": "mainak@example.com",
  "password": "strong-password"
}
```

Success:

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user_...",
      "name": "Mainak Banerjee",
      "email": "mainak@example.com"
    }
  }
}
```

Rules:

- normalize email before lookup/storage
- hash password using Argon2 or equivalent
- never return password hash
- issue access/refresh credentials

## 6.2 Login

```http
POST /api/auth/login
```

Request:

```json
{
  "email": "mainak@example.com",
  "password": "strong-password"
}
```

Do not reveal whether an email exists.

## 6.3 Refresh

```http
POST /api/auth/refresh
```

Refresh-token rotation should occur.

## 6.4 Logout

```http
POST /api/auth/logout
```

Invalidate current refresh session.

## 6.5 Current User

```http
GET /api/me
```

Response:

```json
{
  "success": true,
  "data": {
    "id": "user_...",
    "name": "Mainak Banerjee",
    "email": "mainak@example.com",
    "avatarUrl": null
  }
}
```

## 6.6 Update Profile

```http
PATCH /api/me
```

Allowed fields:

```text
name
avatarMediaId
```

---

# 7. Project APIs

Routes:

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/:projectId
PATCH  /api/projects/:projectId
DELETE /api/projects/:projectId
```

## 7.1 List Projects

```http
GET /api/projects?cursor=...&limit=25
```

Only projects owned by authenticated user.

## 7.2 Create Project

```http
POST /api/projects
```

```json
{
  "name": "Weekly Product Club",
  "description": "Weekly quizzes for the community",
  "coverMediaId": null
}
```

## 7.3 Get Project

```http
GET /api/projects/:projectId
```

Owner only for management payload.

## 7.4 Update Project

```http
PATCH /api/projects/:projectId
```

## 7.5 Delete Project

```http
DELETE /api/projects/:projectId
```

MVP may reject deletion when dependent published/live/completed quizzes exist.

---

# 8. Quiz APIs

Routes:

```text
GET    /api/projects/:projectId/quizzes
POST   /api/projects/:projectId/quizzes
GET    /api/quizzes/:quizId
PATCH  /api/quizzes/:quizId
DELETE /api/quizzes/:quizId
POST   /api/quizzes/:quizId/publish
GET    /api/public/quizzes/:publicId
```

## 8.1 Create Quiz

```http
POST /api/projects/:projectId/quizzes
```

```json
{
  "title": "Product Management Quiz",
  "description": "Weekly live PM challenge",
  "registrationLimit": 500,
  "defaultQuestionDurationSeconds": 20,
  "plannedStartAt": "2026-10-10T13:30:00.000Z",
  "allowLateJoin": true,
  "coverMediaId": null
}
```

Success returns:

```json
{
  "success": true,
  "data": {
    "id": "quiz_...",
    "publicId": "k7F9xP2mR4",
    "status": "DRAFT"
  }
}
```

## 8.2 Get Host Quiz

```http
GET /api/quizzes/:quizId
```

Creator only.

May include correct answers because this is a host-authorized management endpoint.

## 8.3 Update Quiz

```http
PATCH /api/quizzes/:quizId
```

Editable while pre-live.

Once live starts, question content and answer keys become immutable.

Create and update payloads use `plannedStartAt` for the participant-facing date/time. A draft may omit or change this field, but it must exist before publish. It is metadata only and never triggers a lifecycle transition.

## 8.4 Publish Quiz

```http
POST /api/quizzes/:quizId/publish
```

Validate required quiz metadata, `plannedStartAt`, and all question structures before publishing. On success, status becomes `PUBLISHED`, registration opens, and the public URL and QR registration flow are available. Publishing does not open the lobby, start a live session, or create an automatic server action.

## 8.5 Public Quiz Metadata

```http
GET /api/public/quizzes/:publicId
```

Participant-safe response only.

Never include:

```text
correct answers
host-only notes
private question configuration
```

---

# 9. Question APIs

Routes:

```text
POST   /api/quizzes/:quizId/questions
PATCH  /api/questions/:questionId
DELETE /api/questions/:questionId
POST   /api/quizzes/:quizId/questions/reorder
```

## 9.1 Single Choice

```json
{
  "type": "SINGLE_CHOICE",
  "text": "Which metric measures customer retention?",
  "imageMediaId": null,
  "durationOverrideSeconds": null,
  "options": [
    { "text": "Churn Rate", "isCorrect": true },
    { "text": "CAC", "isCorrect": false }
  ]
}
```

Validation:

```text
At least 2 options
Exactly 1 correct option
```

## 9.2 Multiple Choice

```json
{
  "type": "MULTIPLE_CHOICE",
  "text": "Select valid retention metrics.",
  "durationOverrideSeconds": 30,
  "options": [
    { "text": "Churn", "isCorrect": true },
    { "text": "Retention Rate", "isCorrect": true },
    { "text": "Page Views", "isCorrect": false }
  ]
}
```

Validation:

```text
At least 2 options
At least 1 correct option
```

## 9.3 Descriptive

```json
{
  "type": "DESCRIPTIVE",
  "text": "Why is retention important?",
  "durationOverrideSeconds": 45,
  "options": []
}
```

Validation:

```text
No answer options
```

## 9.4 Reorder

```http
POST /api/quizzes/:quizId/questions/reorder
```

```json
{
  "questionIds": ["q3", "q1", "q2"]
}
```

Server verifies all questions belong to quiz and are represented once.

---

# 10. Registration APIs

Routes:

```text
POST   /api/quizzes/:quizId/register
DELETE /api/quizzes/:quizId/register
GET    /api/quizzes/:quizId/registration
GET    /api/quizzes/:quizId/registrations
GET    /api/quizzes/:quizId/registrations/all
```

## 10.1 Register

```http
POST /api/quizzes/:quizId/register
```

Server permits registration only when the quiz is eligible and has status `PUBLISHED`, then performs a concurrency-safe capacity transaction. Registration creates the participant's project association when needed.

Success:

```json
{
  "success": true,
  "data": {
    "registered": true,
    "registeredAt": "...",
    "registrationCount": 218
  }
}
```

Possible errors:

```text
QUIZ_FULL
QUIZ_COMPLETED
ALREADY_REGISTERED
```

## 10.2 Unregister

```http
DELETE /api/quizzes/:quizId/register
```

Allowed only before quiz goes live.

## 10.3 Own Registration

```http
GET /api/quizzes/:quizId/registration
```

## 10.4 Host Registration List

```http
GET /api/quizzes/:quizId/registrations?cursor=...&limit=50
```

Creator only.

Do not expose unnecessary participant email addresses.

## 10.5 Host Full Registration Roster

```http
GET /api/quizzes/:quizId/registrations/all
```

Creator only. Returns every active (`REGISTERED`) registration in one unpaginated array, ordered by `registeredAt` ascending, for the host's published-quiz management screen.

```json
{
  "success": true,
  "data": [
    {
      "id": "registration_...",
      "userId": "user_...",
      "name": "Priya",
      "registeredAt": "..."
    }
  ]
}
```

Uses the same `HostRegistrationDto` as the paginated list and never includes email addresses. The roster size is bounded by `registrationLimit` (protective maximum 10,000). Prefer the paginated `GET /api/quizzes/:quizId/registrations` for any consumer that may render large rosters.

---

# 11. Dashboard APIs

## 11.1 Participant Dashboard

```http
GET /api/dashboard/participant
```

Response shape:

```json
{
  "success": true,
  "data": {
    "upcoming": [],
    "live": [],
    "history": []
  }
}
```

Upcoming includes only registered `PUBLISHED` quizzes that have not started. Project association may support discovery of future published quizzes, but does not itself add an unregistered quiz to Upcoming.

## 11.2 Host Dashboard

```http
GET /api/dashboard/host
```

```json
{
  "success": true,
  "data": {
    "projects": [],
    "draftQuizzes": [],
    "publishedQuizzes": [],
    "liveQuiz": null,
    "completedQuizzes": []
  }
}
```

---

# 12. Result APIs

## 12.1 Host Results

```http
GET /api/quizzes/:quizId/results
```

Creator only.

Example:

```json
{
  "success": true,
  "data": {
    "summary": {
      "participantCount": 500,
      "askedQuestionCount": 12,
      "completedAt": "..."
    },
    "leaderboard": [
      {
        "rank": 1,
        "userId": "user_...",
        "name": "Rahul",
        "score": 8420,
        "correctCount": 10,
        "incorrectCount": 2,
        "notAttemptedCount": 0
      }
    ]
  }
}
```

## 12.2 Participant Result

```http
GET /api/live-sessions/:liveSessionId/my-result
```

MVP response:

```json
{
  "success": true,
  "data": {
    "quiz": {
      "id": "quiz_...",
      "title": "Product Quiz"
    },
    "score": 8420,
    "rank": 4,
    "correctCount": 8,
    "incorrectCount": 2,
    "notAttemptedCount": 1
  }
}
```

Do not include historical question-by-question review in MVP.

---

# 13. Media Upload APIs

Routes:

```text
POST   /api/media/upload-request
POST   /api/media/:mediaId/complete
DELETE /api/media/:mediaId
```

## 13.1 Upload Request

```http
POST /api/media/upload-request
```

Example:

```json
{
  "purpose": "QUESTION_IMAGE",
  "fileName": "product.png",
  "mimeType": "image/png",
  "sizeBytes": 345678,
  "resource": {
    "quizId": "quiz_..."
  }
}
```

Server validates:

- authentication
- MIME type
- maximum size
- resource ownership
- quiz editability
- media purpose

Response:

```json
{
  "success": true,
  "data": {
    "mediaId": "media_...",
    "upload": {
      "url": "https://...",
      "token": "...",
      "path": "..."
    }
  }
}
```

Never expose Supabase service-role credentials.

## 13.2 Complete Upload

```http
POST /api/media/:mediaId/complete
```

Marks media READY after verifying upload where practical.

---

# 14. Pagination

Use cursor pagination for potentially large collections.

```text
?cursor=<opaque>&limit=50
```

Recommended:

```text
Default limit = 25
Maximum limit = 100
```

Response:

```json
{
  "success": true,
  "data": [],
  "meta": {
    "nextCursor": "..."
  }
}
```

---

# 15. DTO Rules

Never return raw Prisma models directly.

Use explicit DTOs.

Example:

```text
Question DB Model
       ↓
HostQuestionDTO
```

and separately:

```text
Question DB Model
       ↓
ParticipantQuestionDTO
```

This is essential for preventing accidental leakage of:

```text
isCorrect
correctOptionIds
```

---

# 16. Socket.IO Namespace and Rooms

Namespace:

```text
/quiz
```

Primary room:

```text
quiz:{liveSessionId}
```

Additional rooms:

```text
quiz:{liveSessionId}:host
quiz:{liveSessionId}:participants
```

---

# 17. Socket Authentication

Socket handshake must authenticate the user.

Server assigns:

```text
socket.data.userId
```

Never trust a client-supplied userId in an event payload.

### Cross-domain handshake (decided 2026-09-29)

The web app and API are deployed on different sites (see PROGRESS, approved architecture clarifications), so the socket handshake must not depend on cookies:

1. The signed-in client requests a ticket over REST: `POST /api/live-sessions/:liveSessionId/socket-ticket`.
2. The server checks the user may access that session and returns a short-lived signed ticket (about 60 seconds, single purpose, bound to the user and live session).
3. The client connects with `io(API_ORIGIN + "/quiz", { auth: { ticket } })`. The server verifies the ticket before the connection is accepted and sets `socket.data.userId` from it.
4. Every reconnect requests a fresh ticket first.

Socket.IO CORS allows the same configured web origins as REST. Tickets are never logged or stored in the browser beyond the connection attempt.

---

# 18. Socket Acknowledgement Format

Success:

```json
{
  "ok": true,
  "data": {}
}
```

Failure:

```json
{
  "ok": false,
  "error": {
    "code": "QUESTION_CLOSED",
    "message": "This question is no longer accepting answers.",
    "requestId": "req_..."
  }
}
```

---

# 19. Client → Server Socket Events

MVP events:

```text
session:join
session:leave
session:sync
answer:submit
host:quiz-start
host:question-start
host:leaderboard-show
host:leaderboard-hide
host:leaderboard-get
host:late-join-set
host:quiz-end
```

---

# 20. Server → Client Socket Events

General:

```text
session:snapshot
quiz:started
question:started
question:ended
question:result
leaderboard:shown
leaderboard:hidden
quiz:ended
session:replaced
session:error
```

Host-only:

```text
host:presence-updated
host:distribution-updated
host:descriptive-response-added
```

---

# 21. `session:join`

Client → Server:

```json
{
  "liveSessionId": "session_..."
}
```

Server validates:

1. authenticated user
2. live session exists
3. registration exists
4. session not completed
5. late-join policy
6. one-device policy

Then:

```text
UPSERT ParticipantSession
Join rooms
Store Redis presence
Return authoritative snapshot
```

---

# 22. Participant Session Snapshot

Example:

```json
{
  "state": "QUESTION_ACTIVE",
  "quiz": {
    "id": "quiz_...",
    "title": "Product Quiz"
  },
  "currentQuestion": {
    "askedQuestionId": "aq_...",
    "type": "SINGLE_CHOICE",
    "text": "Which metric...",
    "imageUrl": null,
    "options": [
      {
        "id": "opt_1",
        "text": "Churn Rate"
      }
    ],
    "startedAt": "...",
    "endsAt": "..."
  },
  "submission": null,
  "score": 4280,
  "rank": 47
}
```

While question is active, snapshot must not include:

```text
correctOptionIds
live distribution
```

---

# 23. Host Session Snapshot

Host snapshot may additionally include:

```text
correctOptionIds
live distribution
connected count
submitted count
available unanswered questions
```

Host and participant DTO serializers must remain separate.

---

# 24. `session:sync`

Client → Server:

```json
{
  "liveSessionId": "session_..."
}
```

Use after:

- reconnect
- refresh
- browser focus
- stale state suspicion

Return authoritative role-safe snapshot.

---

# 25. `host:quiz-start`

Host → Server:

```json
{
  "liveSessionId": "session_..."
}
```

Server:

- verifies host ownership
- validates state
- activates session
- initializes Redis
- broadcasts `quiz:started`

No question starts automatically.

---

# 26. `host:question-start`

Host → Server:

```json
{
  "liveSessionId": "session_...",
  "questionId": "question_..."
}
```

Server validates:

- host ownership
- valid state
- question belongs to quiz
- question not previously asked

Then:

```text
Create AskedQuestion
Determine duration
Store startedAt/endsAt
Update Redis
Broadcast question:started
```

---

# 27. `question:started` Participant Payload

```json
{
  "askedQuestionId": "aq_...",
  "question": {
    "id": "question_...",
    "type": "SINGLE_CHOICE",
    "text": "Which metric...",
    "imageUrl": null,
    "options": [
      {
        "id": "option_1",
        "text": "Churn Rate"
      },
      {
        "id": "option_2",
        "text": "CAC"
      }
    ]
  },
  "startedAt": "2026-10-01T12:00:00.000Z",
  "endsAt": "2026-10-01T12:00:20.000Z"
}
```

Never include:

```text
correct answers
isCorrect
live distribution
```

---

# 28. `answer:submit`

Single choice:

```json
{
  "liveSessionId": "session_...",
  "askedQuestionId": "aq_...",
  "clientRequestId": "client-uuid",
  "selectedOptionIds": ["option_1"]
}
```

Multiple choice:

```json
{
  "liveSessionId": "session_...",
  "askedQuestionId": "aq_...",
  "clientRequestId": "client-uuid",
  "selectedOptionIds": ["option_1", "option_3"]
}
```

Descriptive:

```json
{
  "liveSessionId": "session_...",
  "askedQuestionId": "aq_...",
  "clientRequestId": "client-uuid",
  "answerText": "Retention improves unit economics."
}
```

Server rejects/ignores client-supplied:

```text
userId
points
isCorrect
responseTime
submittedAt
```

---

# 29. Answer Submission Validation

Server checks:

```text
authenticated socket
active device/session
registered participant
current AskedQuestion
question active
server time < endsAt
no existing submission
valid answer shape
option IDs belong to question
```

Then:

```text
calculate correctness
calculate responseTimeMs
calculate points
persist answer
update Redis distribution
update Redis leaderboard
acknowledge participant
```

---

# 30. Answer Acknowledgement

Before question expiry:

```json
{
  "ok": true,
  "data": {
    "submissionId": "submission_...",
    "acceptedAt": "2026-10-01T12:00:08.200Z"
  }
}
```

Do not reveal before expiry:

```text
correctness
points
live distribution
```

---

# 31. `host:distribution-updated`

Host-only:

```json
{
  "askedQuestionId": "aq_...",
  "submittedCount": 217,
  "optionCounts": {
    "option_1": 91,
    "option_2": 72,
    "option_3": 54
  }
}
```

May be throttled/coalesced approximately every 100–500 ms under burst load.

---

# 32. `host:descriptive-response-added`

Host-only:

```json
{
  "askedQuestionId": "aq_...",
  "responseId": "submission_...",
  "text": "Retention improves customer lifetime value."
}
```

MVP presentation intentionally omits participant identity.

---

# 33. `question:ended`

Server → Session:

```json
{
  "askedQuestionId": "aq_...",
  "endedAt": "..."
}
```

Question expiry is controlled by server `endsAt`, never by client timer.

---

# 34. `question:result`

Participant-specific scored result:

```json
{
  "askedQuestionId": "aq_...",
  "status": "SUBMITTED",
  "selectedOptionIds": ["option_2"],
  "correctOptionIds": ["option_1"],
  "isCorrect": false,
  "pointsAwarded": 0,
  "totalScore": 4280,
  "rank": 47,
  "participantCount": 500,
  "finalDistribution": {
    "option_1": 250,
    "option_2": 150,
    "option_3": 100
  }
}
```

Not attempted:

```json
{
  "askedQuestionId": "aq_...",
  "status": "NOT_ATTEMPTED",
  "selectedOptionIds": [],
  "correctOptionIds": ["option_1"],
  "isCorrect": null,
  "pointsAwarded": 0,
  "totalScore": 4280,
  "rank": 47,
  "participantCount": 500,
  "finalDistribution": {}
}
```

---

# 35. Descriptive Question Result

```json
{
  "askedQuestionId": "aq_...",
  "status": "SUBMITTED",
  "answerText": "Retention improves customer lifetime value.",
  "pointsAwarded": 0,
  "totalScore": 4280,
  "rank": 47,
  "participantCount": 500
}
```

No correct answer exists.

---

# 36. `host:leaderboard-show`

Host → Server:

```json
{
  "liveSessionId": "session_...",
  "audience": "PARTICIPANTS"
}
```

Server updates shared live presentation state and broadcasts Top 10.

---

# 37. `leaderboard:shown`

```json
{
  "top": [
    {
      "rank": 1,
      "userId": "user_1",
      "name": "Rahul",
      "score": 8420
    },
    {
      "rank": 1,
      "userId": "user_2",
      "name": "Priya",
      "score": 8420
    },
    {
      "rank": 3,
      "userId": "user_3",
      "name": "Arjun",
      "score": 8310
    }
  ]
}
```

Maximum public leaderboard size:

```text
Top 10
```

---

# 38. Host Private Leaderboard

Recommended socket request:

```text
host:leaderboard-get
```

This does not change shared participant presentation state.

---

# 39. `host:leaderboard-hide`

Returns shared presentation to latest question result.

If the host starts another question directly, explicit hide is unnecessary.

---

# 40. `host:late-join-set`

```json
{
  "liveSessionId": "session_...",
  "allow": false
}
```

Host only.

---

# 41. `host:quiz-end`

```json
{
  "liveSessionId": "session_..."
}
```

Server:

```text
Authorize host
Acquire completion lock
Finalize active question if required
Finalize not-attempted counts
Generate QuizResults
Mark session COMPLETED
Mark quiz COMPLETED
Update Redis
Broadcast quiz:ended
```

Must be idempotent.

---

# 42. `quiz:ended`

Participant-specific:

```json
{
  "liveSessionId": "session_...",
  "finalScore": 8420,
  "finalRank": 4,
  "correctCount": 8,
  "incorrectCount": 2,
  "notAttemptedCount": 1
}
```

Final leaderboard is still host-controlled.

---

# 43. `session:replaced`

Sent to old socket when same user joins same quiz from a newer active session.

```json
{
  "reason": "A newer session was opened for this quiz."
}
```

Old socket loses ability to submit.

---

# 44. Reconnection

On reconnect:

```text
authenticate
→ session:join / session:sync
→ authoritative snapshot
```

If active question remains open:

- unsubmitted participant may continue with remaining time
- already submitted participant remains locked

If expiry has passed, backend finalizes/synchronizes first.

---

# 45. Host Reconnection

Host reconnect should resolve existing active LiveQuizSession rather than create another.

Return:

```text
current state
current question
correct answer
live distribution
connected count
leaderboard
remaining unanswered questions
```

---

# 46. Rate Limiting

Sensitive REST endpoints:

```text
POST /auth/login
POST /auth/signup
POST /auth/refresh
POST /quizzes/:id/register
POST /media/upload-request
```

Sensitive socket commands:

```text
session:join
answer:submit
host:question-start
host:quiz-end
```

Use Redis counters.

Exact numeric limits belong in Security Design.

---

# 47. CORS and CSRF

Express allows configured web origins only.

Socket.IO origin policy must match REST policy.

If web authentication uses cookies:

- use HttpOnly
- use Secure
- use suitable SameSite
- validate Origin/Referer where appropriate
- introduce CSRF token if required by final cookie setup

---

# 48. Public vs Private API Boundary

Public:

```text
GET /api/public/quizzes/:publicId
```

Authenticated:

```text
/api/me
/api/projects/*
/api/quizzes/*
/api/dashboard/*
```

Host-only:

```text
quiz editing
questions
registration list
host results
live controls
```

Socket namespace is authenticated.

There is no anonymous quiz participation in MVP.

---

# 49. Cache Policy

Private user-specific API responses:

```text
Cache-Control: no-store
```

Public quiz metadata may use short-lived caching only if viewer-specific fields are excluded or separately resolved.

---

# 50. Health Endpoint

```http
GET /api/health
```

Response:

```json
{
  "status": "ok"
}
```

Do not publicly expose detailed database/Redis credentials or internals.

---

# 51. Shared Zod Schemas

Every external contract must be validated.

Examples:

```text
SignupSchema
LoginSchema
CreateProjectSchema
CreateQuizSchema
CreateQuestionSchema
RegisterQuizSchema
MediaUploadRequestSchema
SessionJoinSchema
HostQuestionStartSchema
AnswerSubmitSchema
HostQuizEndSchema
```

Safe schemas/types may live in shared monorepo packages.

---

# 52. Request IDs

Every REST request and important socket command should have a request ID.

Use for:

- application logs
- debugging realtime failures
- duplicate command investigation
- user-facing support references

Never use request IDs as authorization credentials.

---

# 53. API Testing Requirements

REST endpoints should test:

```text
happy path
validation failure
unauthenticated
unauthorized
not found
state conflict
rate limit
```

Critical concurrency tests:

```text
registration final slot
answer double submission
quiz double completion
question double start
```

---

# 54. Socket Testing Requirements

Test:

```text
unauthenticated connection rejected
registered participant joins
unregistered participant rejected
late join disabled
participant cannot issue host command
question starts
answer accepted
duplicate answer rejected
late answer rejected
correct answer hidden before expiry
live distribution host-only
question result sent after expiry
leaderboard show/hide
second device replaces first
participant reconnect
host reconnect
quiz end is idempotent
```

---

# 55. API Implementation Order

## Phase 1 — Authentication

```text
signup
login
refresh
logout
me
```

## Phase 2 — Projects

```text
project CRUD
ownership authorization
pagination
```

## Phase 3 — Quiz Builder

```text
quiz CRUD
question CRUD
reorder
publish
```

## Phase 4 — Registration

```text
register
unregister
own registration
host registrations
```

## Phase 5 — Dashboards and Results

```text
participant dashboard
host dashboard
completed result reads
```

## Phase 6 — Media

```text
upload request
complete upload
delete media
```

## Phase 7 — Socket Foundation

```text
namespace
authentication
rooms
session join
session sync
presence
one-device replacement
```

## Phase 8 — Host Live Controls

```text
quiz start
question start
late join toggle
```

## Phase 9 — Answers

```text
answer submit
acknowledgement
host distribution
descriptive response events
```

## Phase 10 — Results and Presentation

```text
question end
question result
leaderboard show/hide
host private leaderboard
```

## Phase 11 — Completion

```text
quiz end
final result
quiz ended event
```

## Phase 12 — Hardening

```text
rate limits
reconnect
duplicate commands
payload leakage tests
load testing
```

---

# 56. Definition of Done

The API implementation is complete when:

- REST endpoints use consistent success/error contracts
- authentication works independently of Next.js internals
- owner authorization is server-side
- public quiz APIs never expose correct answers
- registration capacity is safe under concurrency
- question CRUD obeys quiz-state restrictions
- all inputs use Zod validation
- API returns DTOs instead of raw Prisma models
- participant and host DTOs are separated
- answer submission is idempotent
- server time determines answer eligibility
- participant cannot submit score/correctness/rank
- host-only socket events are authorized server-side
- correct answers are unavailable to participants before expiry
- live percentages are unavailable to participants before expiry
- reconnection restores authoritative state
- newest participant session replaces older one
- host can show/hide Top 10 leaderboard
- quiz completion is idempotent
- final results are available through REST without Redis
- critical REST and Socket tests pass

---

**End of API Design Document**

## Authoring implementation notes — 2026-09-28

The current authoring slice implements the project list/create/read/update, project quiz list/create, host quiz read/update, question create/update/delete/reorder, and media upload-request/complete/delete routes above. Project/quiz deletion, public quiz views, and publishing remain deferred.

- Explicit-save clients submit complete editable field sets on PATCH. Strict validation rejects lifecycle writes, quiz project reassignment, and unknown fields.
- Quiz draft create/update includes nullable `plannedStartAt` as planned-date metadata only. It does not transition status. New quizzes always remain `DRAFT`; publishing must reject a missing `plannedStartAt`.
- Host quiz responses and question mutation responses return the current owned quiz with ordered questions and answer keys. They must never be reused as participant DTOs.
- Media completion returns `{ id, fileName, url }`, where `url` is a one-hour private read URL. Media deletion returns 204 and is rejected while any quiz/question references the asset.
- PNG/JPEG/WebP uploads up to 10 MiB are supported. Uploads require an existing owned, editable quiz; project covers are not part of this slice.
- List responses include `meta.nextCursor` with a page size of 25. Cursors are UUIDs interpreted as stable ascending keyset positions.
- Runtime schemas and DTOs live in `packages/contracts/src/index.ts`; centralized protective input limits are documented in PROGRESS.MD.

## Publishing and registration implementation notes — 2026-09-29

The publishing slice implements `POST /api/quizzes/:quizId/publish`, `GET /api/public/quizzes/:publicId`, the registration routes in section 10 (including the `/registrations/all` roster in 10.5), and both dashboard routes in section 11. This supersedes the "publishing remain deferred" statement in the authoring notes above.

- Publishing requires `DRAFT` status, `plannedStartAt`, and at least one question that passes the shared question schema. A missing `plannedStartAt` returns `422 VALIDATION_ERROR` with `details.plannedStartAt`; the check is repeated inside the locked publish transaction. Publishing an already published quiz returns it unchanged.
- Quiz create/update payloads now require `plannedStartAt`, so it cannot be cleared through the API; drafts saved before it became required can still hold `null` and cannot be published until it is set.
- Registration locks the quiz row (`SELECT … FOR UPDATE`) before counting `REGISTERED` rows, so concurrent requests are serialized and capacity cannot be exceeded. Waiting requests queue for up to 15 seconds instead of failing.
- Additional error codes beyond section 5: `HOST_CANNOT_REGISTER` (403, host registering for their own quiz), `REGISTRATION_CLOSED` (409, quiz not `PUBLISHED`), `UNREGISTRATION_CLOSED` (409, quiz `LIVE` or `COMPLETED`), `NOT_REGISTERED` (404 on unregister), and `QUIZ_LOCKED` (409, publishing a non-draft quiz).
- `GET /api/public/quizzes/:publicId` returns `PublicQuizDto` for `PUBLISHED`, `LOBBY`, `LIVE`, and `COMPLETED` quizzes only; drafts return 404. It never includes options or answer keys.
- `GET /api/dashboard/host` currently returns `{ projects, quizzes }` (quizzes of every status, grouped by the web client) rather than the per-status lists sketched in 11.2. `GET /api/dashboard/participant` returns `upcoming`; `live` and `history` are empty until later phases.


## Live session implementation notes — Phase 5 — 2026-09-29

Implemented REST routes (authenticated, Origin-checked, owner/registration checks on the server):

- `POST /api/quizzes/:quizId/live-session` — host opens the lobby for a `PUBLISHED` quiz (quiz → `LOBBY`, session `LOBBY`, `allowLateJoin` copied from the quiz). Idempotent for the same quiz (returns the existing session). `409 ACTIVE_SESSION_EXISTS` with `details.liveSessionId`/`details.quizId` when the host has another unfinished session; `409 QUIZ_NOT_OPEN` for drafts; `409 QUIZ_COMPLETED`; `404` for non-owners.
- `GET /api/quizzes/:quizId/live-session` — the quiz's unfinished session as `LiveSessionRefDto { id, quizId, state, role }` for its host or a registered participant; `403 REGISTRATION_REQUIRED` otherwise; `404 SESSION_NOT_FOUND` when none is open.
- `GET /api/live-sessions/active` — the host's unfinished session (`ActiveHostSessionDto`) or `null`; drives the conflict screen.
- `POST /api/live-sessions/:liveSessionId/socket-ticket` — `{ ticket, expiresAt }` (60 seconds) for the host or a registered participant (see §17 cross-domain handshake).

Socket.IO (`/quiz` namespace) as implemented:

- Handshake: `auth.ticket` is verified before the connection is accepted; `allowRequest` also rejects WebSocket upgrades from origins outside `ALLOWED_ORIGINS` (requests without an Origin still need a ticket). Command payloads must target the ticket's live session.
- `session:join` → role-safe snapshot (`HostLiveSnapshotDto` with roster ≤ 100 and host questions including answer keys; `ParticipantLiveSnapshotDto` with neither). Participants must be registered; after the quiz starts, first-time entrants need late join enabled (`403 LATE_JOIN_DISABLED`) while returning attendees always reconnect; completed sessions return `QUIZ_COMPLETED`. The newest participant socket replaces the previous one (`session:replaced`, then a forced disconnect). The host may keep several tabs connected.
- `session:sync` (participants must still be the active device, else `SESSION_REPLACED`) and `session:leave`.
- Host-only commands with server-side host checks and a short Redis lock: `host:quiz-start` (`LOBBY → LIVE_IDLE`, quiz → `LIVE`, closes registration and locks content), `host:late-join-set`, and a minimal `host:quiz-end` (session and quiz → `COMPLETED`, idempotent; results and leaderboard arrive in Phase 10). Invalid transitions return `INVALID_STATE_TRANSITION`; concurrent transitions `OPERATION_IN_PROGRESS`.
- Server → client: after every lifecycle change the server broadcasts a full role-safe `session:snapshot` to the host and participant rooms (instead of separate `quiz:started`/`quiz:ended` events in Phase 5). `host:presence-updated { userId, connected, connectedCount }` goes to the host room only. Participants receive `session:connected-count { connectedCount }`, throttled to at most one update per 2 seconds per session (sent in memory, no Redis commands).
- Acknowledgements use `{ ok: true, data } | { ok: false, error: { code, message } }`.
- Additional codes: `REGISTRATION_CLOSED` also applies once the quiz is `LIVE` (registration stays open in `LOBBY`), `LIVE_UNAVAILABLE` (503, Redis unreachable), `NOT_JOINED`, `OPERATION_IN_PROGRESS`.
- `GET /api/dashboard/participant` now fills `live` with registered quizzes in `LOBBY` or `LIVE`.
- `host:lobby-close` (host only, `LOBBY` state only, else `INVALID_STATE_TRANSITION`): cancels an unstarted lobby. The session and its lobby attendance are deleted, presence is cleared and the quiz returns to `PUBLISHED` with registrations kept. Other sockets in the room receive `session:removed { code: 'LOBBY_CLOSED' }` and are disconnected; the ack carries no snapshot.
- Registration changes while a session is open (registration stays open in `LOBBY`): every register/unregister pushes a fresh host `session:snapshot` (roster and counts). An unregistering participant's presence and lobby attendance are removed, and their socket receives `session:removed { code: 'REGISTRATION_REQUIRED', message }` before being disconnected. `session:sync` re-checks registration.

## Quiz status socket — 2026-09-29

Read-only lifecycle updates for the public quiz page, so registered participants see **Enter live room** (and lobby closed, started, ended) without reloading.

- `POST /api/quizzes/:quizId/watch-ticket` → `{ ticket, expiresAt }` (60 seconds) for any signed-in user and any non-draft quiz (`404` for drafts). Lifecycle status is already public, so registration is not required. Watch tickets use their own audience: they cannot join `/quiz`, and live tickets cannot watch.
- Namespace `/quiz-status`: the handshake verifies `auth.ticket`; the socket watches only the ticket's quiz, receives `quiz:status { quizId, status }` on connect and after every change. There are no client commands.
- Status changes are published in-process when a lobby opens (`LOBBY`), closes (`PUBLISHED`), the quiz starts (`LIVE`) or ends (`COMPLETED`). No Redis commands are used; like other in-process events this assumes a single API instance.


## Live questions — Phase 6 — 2026-10-01

Question delivery and submission on the `/quiz` namespace. Answer reveal (correct answer and final distribution) and the host's live answer breakdown are included now; points, score and rank remain Phase 7.

- `host:question-start { liveSessionId, questionId }` (host only, from `LIVE_IDLE` or `QUESTION_RESULT`): any unused question, in any order, starts immediately; session → `QUESTION_ACTIVE`. Creates an `AskedQuestion` (live `sequenceNumber`, `durationSeconds`, `startedAt`, `endsAt`). `QUESTION_ALREADY_ASKED` for a reused question, `INVALID_STATE_TRANSITION` while another question is active, `404` for a question from another quiz.
- `answer:submit { liveSessionId, askedQuestionId, selectedOptionIds? | answerText? }` (participants only): accepted only from the participant's active device (`SESSION_REPLACED`), while server time is before `endsAt` (`SUBMISSION_CLOSED`), once per participant (`ALREADY_SUBMITTED`) and with a valid shape (`INVALID_ANSWER`: exactly one option for single choice, one or more distinct options for multiple answer, text up to `ANSWER_LIMITS.text` for descriptive; options must belong to the question). The ack is `ParticipantAnswerDto` with `isCorrect: null` and `pointsAwarded: 0` while the question is active. Correctness is decided on the server at submission; multiple answer is all-or-nothing.
- Expiry: the server closes the question at `endsAt` (in-process timer, re-armed at boot), and any join, sync, submission or question start also closes an overdue question first. Clients sync when their countdown reaches zero. Closing is exactly-once (row lock + status check); the session → `QUESTION_RESULT`. `host:quiz-end` during a question closes it at the current server time.
- Snapshots carry `serverTime` for clock offset. Participant snapshots include `question` (participant-safe, `reveal: null` while active; `reveal { correctOptionIds, distribution, submittedCount }` after it ends). Personal fields `myAnswer` and `joinedDuringQuestion` appear only in snapshots addressed to one participant (join, sync, and the per-participant snapshot sent when a question ends); broadcasts omit them. Not attempted is derived (no row stored), shown as `myAnswer.status: 'NOT_ATTEMPTED'` after the end.
- Host snapshots include `askedQuestions` and `currentQuestion` (active or just ended, with `submittedCount`, per-option `distribution` and the newest 50 descriptive `responses` without participant identity). `host:submissions-updated` (host room only) sends the same progress at most once per second per session.
- Hot path: an answer costs one database statement (single atomic insert guarded by a shared row lock on the asked question) plus one Redis `HGET` for the active device; answer keys and confirmed registrations are cached in memory per session (single API instance).

## Scoring and personal rank — Phase 7 — 2026-10-01

- Points are decided on the server when an answer is accepted and revealed only after the question ends: a correct answer earns `1000 × (1 − 0.6 × responseTime / duration)`, rounded (about 1000 instant, 700 at half time, 400 at the deadline); incorrect, not attempted and descriptive answers earn 0; multiple answer is all-or-nothing. Constants live in `SCORING` (API live-sessions constants); not configurable in the UI.
- Standings are computed in PostgreSQL in one query when a question ends: each participant's total over completed asked questions only (an active question never changes standings), ranked with shared ranks on exact ties (1, 1, 3). `participantCount` is everyone who entered the live session, including zero scores. This replaces the Redis sorted-set leaderboard from the database design to keep Upstash command usage low; the database remains the source of truth.
- Delivery: the per-participant reveal snapshot is sent first, then `participant:standing { askedQuestionId, totalScore, rank, participantCount }` to each connected participant, so clients show the reveal while the standing loads. Personal snapshots (join, sync) include `myStanding` once the current question has ended.

## Live distribution and result screen — Phase 8 — 2026-10-01

Delivered with Phase 6: host-only live counts, percentages and descriptive responses (`host:submissions-updated`), automatic reveal at expiry with the correct answer and final distribution for participants, correct/incorrect states and the post-question waiting state. Participants receive neither the answer key, the distribution nor host progress before expiry (covered by the live questions integration test).

## Host presentation controls and leaderboard — Phase 9 — 2026-10-01

- `host:leaderboard-get` (host only): returns `LeaderboardDto { entries: [{ rank, userId, name, score }], participantCount, afterQuestionNumber }` without changing participant screens (host private view).
- `host:leaderboard-show` (host only, from `QUESTION_RESULT`): session → `LEADERBOARD`; host and participant snapshots carry `leaderboard`, and participants see the Top 10 instead of the question result, with their own rank (`myStanding`) still available. `host:leaderboard-hide` returns to `QUESTION_RESULT` with the latest result. Asking the next question from `LEADERBOARD` hides it implicitly. Showing during a question returns `INVALID_STATE_TRANSITION`.
- Top 10 is everyone ranked 10th or better (`LEADERBOARD_SIZE`), so ties at the boundary can add rows; ties share a rank and are ordered by name. Computed in PostgreSQL from completed questions, like standings.
- Timer expiry never advances: the host keeps the finished question (or the leaderboard) on screen until choosing the next question.
- Performance: the leaderboard and the ended question's final results are cached per session until the next question ends (or someone new enters), and concurrent host and participant snapshots share one query. Showing or hiding is a single conditional update (`state` must match), and the live session row loads in one SQL query.
