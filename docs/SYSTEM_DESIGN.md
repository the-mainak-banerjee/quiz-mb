# Live Quiz Platform
## System Design Architecture Document

**Version:** V1  
**Status:** Approved Architecture Baseline  
**Architecture Style:** Modular Monolith  
**Application Type:** Web-first Realtime Quiz Platform  
**Target MVP Scale:** ~500 concurrent participants per live quiz  
**Future Client:** React Native mobile application  

---

# 1. Purpose

This document defines the high-level system architecture for the **Live Quiz Platform**.

The purpose is to establish:

- Overall system architecture
- Major system components
- Frontend/backend boundaries
- Modular monolith structure
- Authentication architecture
- Authorization model
- REST API architecture
- Realtime architecture
- Socket.IO communication
- Redis responsibilities
- PostgreSQL responsibilities
- Live-session state management
- Scoring architecture
- Leaderboard architecture
- File-storage architecture
- Deployment topology
- Security principles
- Reliability and failure handling
- Scaling strategy
- Testing considerations
- Important architectural decisions

This document intentionally remains at the **system design level**.

Detailed:

- PostgreSQL tables
- Prisma schemas
- Exact Redis keys
- REST request/response contracts
- Socket.IO event payloads
- Exact folder structure
- UI component architecture
- Detailed test cases

will be designed separately.

---

# 2. Architecture Goals

The architecture should prioritize:

1. **Simplicity**
2. **Realtime reliability**
3. **Fast MVP development**
4. **Clear frontend/backend separation**
5. **Strong domain boundaries**
6. **Low infrastructure cost**
7. **Portfolio-quality architecture**
8. **Mobile-client compatibility**
9. **Security and competitive integrity**
10. **Ability to scale incrementally**
11. **Avoidance of premature microservices**

The MVP should comfortably support approximately:

```text
~500 concurrent participants
inside one live quiz
```

while also supporting:

```text
Host A → Live Quiz A
Host B → Live Quiz B
Host C → Live Quiz C
```

simultaneously.

The design should allow scaling beyond this without requiring a complete architectural rewrite.

---

# 3. Architecture Principles

## 3.1 Modular Monolith

The backend will operate as a single application.

We will **not** create separate microservices for:

- Authentication
- Quizzes
- Scoring
- Leaderboards
- Realtime sessions
- Storage
- Registrations

Instead:

```text
Express Backend

├── Auth
├── Users
├── Projects
├── Quizzes
├── Questions
├── Registrations
├── Live Sessions
├── Answers
├── Scoring
├── Leaderboards
├── Results
└── Storage
```

Each domain owns its business logic.

---

## 3.2 Separate Frontend and Backend Applications

The platform will use:

```text
Next.js Web Application
+
Express Backend Application
```

Both applications live in the same monorepo.

Reasons:

- realtime requirements,
- future React Native client,
- clean API boundaries,
- framework-independent business logic,
- easier backend portability.

---

## 3.3 REST for Business Operations

Normal application operations use REST.

Examples:

```text
Create Project
Create Quiz
Register for Quiz
Load Dashboard
Fetch Quiz History
Upload Image Metadata
```

Realtime interactions use Socket.IO.

Examples:

```text
Start Question
Receive Question
Submit Live Answer
Update Host Distribution
Show Leaderboard
End Quiz
Reconnect Session
```

We will not force every operation through WebSockets.

---

## 3.4 Server is Authoritative

The frontend must never be trusted for competitive state.

The server owns:

- Question timer
- Answer submission time
- Answer locking
- Correctness
- Score calculation
- Rank calculation
- Quiz state
- Registration capacity
- Host permissions

The browser displays state.

It does not define it.

---

## 3.5 PostgreSQL for Durable State

PostgreSQL stores permanent application information.

Examples:

```text
Users
Projects
Quizzes
Questions
Registrations
Asked Questions
Submitted Answers
Quiz Results
```

---

## 3.6 Redis for Ephemeral Realtime State

Redis stores fast-changing temporary information.

Examples:

```text
Current quiz state
Current active question
Question start/end timestamps
Connected participants
Live answer counts
Leaderboard cache
Rate limits
Socket.IO coordination
Distributed locks
```

Redis does **not** replace PostgreSQL.

---

# 4. Technology Stack

| Layer | Technology |
|---|---|
| Language | TypeScript |
| Frontend | Next.js |
| Styling | Tailwind CSS |
| Backend | Node.js |
| Backend Framework | Express |
| API Style | REST |
| Realtime | Socket.IO |
| Architecture | Modular Monolith |
| Database | PostgreSQL |
| Database Provider | Supabase |
| ORM | Prisma |
| Validation | Zod |
| Redis | Upstash Redis |
| File Storage | Supabase Storage |
| Authentication | Custom authentication |
| Password Hashing | Argon2 / equivalent established library |
| Monorepo | pnpm + Turborepo |
| Frontend Hosting | Vercel |
| Backend Hosting | Vercel |
| Logging | Application + Vercel logs |
| Product Analytics | Not required in MVP |
| Microservices | Not used |

---

# 5. High-Level System Architecture

```text
                        ┌────────────────────────┐
                        │       Web Browser      │
                        │                        │
                        │ Host + Participants    │
                        └────────────┬───────────┘
                                     │
                       HTTPS / Socket.IO
                                     │
             ┌───────────────────────┴──────────────────────┐
             │                                              │
             ▼                                              ▼
┌──────────────────────────┐                 ┌──────────────────────────┐
│       Next.js App        │                 │       Express API        │
│         Vercel           │                 │         Vercel           │
│                          │                 │                          │
│ React UI                 │                 │ REST API                 │
│ Server Components        │                 │ Socket.IO                │
│ Client Components        │                 │ Business Services        │
│ Tailwind CSS             │                 │ Auth                     │
└──────────────────────────┘                 │ Scoring                  │
                                             │ Realtime State           │
                                             └──────────┬───────────────┘
                                                        │
                             ┌──────────────────────────┼────────────────────┐
                             │                          │                    │
                             ▼                          ▼                    ▼
                   ┌─────────────────┐        ┌─────────────────┐  ┌─────────────────┐
                   │   PostgreSQL    │        │      Redis      │  │ Supabase Storage│
                   │    Supabase     │        │     Upstash     │  │                 │
                   │                 │        │                 │  │ Quiz Images     │
                   │ Durable Data    │        │ Realtime State  │  │ Covers          │
                   └─────────────────┘        └─────────────────┘  └─────────────────┘
```

Future:

```text
                    React Native App
                           │
                  REST + Socket.IO
                           │
                           ▼
                      Express API
```

---

# 6. Monorepo Architecture

The system will use:

```text
pnpm
+
Turborepo
```

Conceptually:

```text
repository/

├── apps/
│   ├── web/
│   │   └── Next.js
│   │
│   └── api/
│       └── Express + Socket.IO
│
└── packages/
    ├── database/
    ├── validation/
    ├── shared-types/
    ├── config/
    └── shared-utils/
```

Exact folder structure will be decided later.

The important architectural boundary is:

```text
apps/web
```

must not directly access PostgreSQL.

Instead:

```text
Web
 ↓
API
 ↓
Business Services
 ↓
Persistence
```

---

# 7. Backend Modular Architecture

Conceptually:

```text
Express Application

├── Auth
├── Users
├── Projects
├── Quizzes
├── Questions
├── Registrations
├── Live Sessions
├── Answers
├── Scoring
├── Leaderboards
├── Results
└── Storage
```

Each module should contain its own:

```text
Route / Socket Handler
        ↓
Validation
        ↓
Service
        ↓
Repository
        ↓
PostgreSQL / Redis
```

Example:

```text
Answer Submission
        ↓
Socket Handler
        ↓
Answer Validation
        ↓
Answer Service
        ↓
Scoring Service
        ↓
Answer Repository
        ↓
PostgreSQL
```

---

# 8. Thin API / Socket Handlers

REST controllers and Socket.IO handlers should remain thin.

Their responsibilities:

1. Parse input
2. Authenticate
3. Authorize
4. Validate
5. Call business service
6. Map errors
7. Return response / acknowledgement

They should **not** contain significant business logic.

Avoid:

```text
socket.on("submit_answer", () => {

   // validation
   // timing logic
   // scoring logic
   // database queries
   // leaderboard updates
   // distribution calculation
   // broadcasting

})
```

Prefer:

```text
Socket Handler
      ↓
AnswerService.submitLiveAnswer()
```

---

# 9. Application Surfaces

The product has three primary application surfaces.

## 9.1 Host Dashboard

Example conceptual route:

```text
/app/*
```

Requires authentication.

Contains:

- Projects
- Quiz builder
- Scheduled quizzes
- Live quizzes
- Completed quizzes
- Live host controls
- Results

## 9.2 Participant Dashboard

Contains:

```text
Upcoming
Live
History
Projects
```

Participants can:

- access registered quizzes,
- enter live sessions,
- see completed results.

## 9.3 Shared Quiz Entry

Example:

```text
/quiz/:publicId
```

Accessible from:

- Shared URL
- QR code
- Dashboard

If authentication is required:

```text
Quiz Link
   ↓
Authentication
   ↓
Return to same Quiz
```

---

# 10. Authentication Architecture

The platform will implement custom authentication.

No:

- Clerk
- Auth0
- Supabase Auth
- Better Auth

for MVP.

The backend owns authentication.

---

# 11. Signup Flow

```text
User
 │
 ▼
POST /auth/signup
 │
 ▼
Validate Input
 │
 ▼
Check Email Uniqueness
 │
 ▼
Hash Password
 │
 ▼
Create User
 │
 ▼
Create Authentication Session
 │
 ▼
Return Auth Credentials / Cookies
```

---

# 12. Password Security

Passwords must never be stored directly.

Conceptually:

```text
Plain Password
      ↓
Argon2
      ↓
Password Hash
      ↓
PostgreSQL
```

Cryptographic algorithms must never be implemented manually.

---

# 13. Authentication Session Model

Because the backend will eventually support both:

```text
Web
+
React Native
```

authentication should not depend entirely on Next.js.

Recommended architecture:

```text
Short-lived Access Token
+
Long-lived Refresh Token
```

## 13.1 Access Token

Contains minimal authentication identity.

Conceptually:

```text
userId
sessionId
expiresAt
```

Short expiry.

Example:

```text
~15 minutes
```

Exact timing can be determined during security design.

## 13.2 Refresh Token

Refresh token should be:

- random,
- high entropy,
- revocable,
- rotated,
- stored securely.

Backend persists a secure representation of refresh sessions.

## 13.3 Web Storage

Web application should prefer:

```text
HttpOnly
Secure
SameSite
```

cookies.

Sensitive authentication credentials should not be stored in:

```text
localStorage
```

## 13.4 Future React Native

Future mobile application may store refresh credentials using secure platform storage.

The same backend authentication service remains usable.

---

# 14. Logout

```text
User
 ↓
POST /auth/logout
 ↓
Invalidate Refresh Session
 ↓
Clear Auth Credentials
```

---

# 15. Authorization Model

MVP roles are effectively:

```text
HOST
PARTICIPANT
```

These are contextual rather than necessarily global database roles.

The same user may be:

```text
Host of Quiz A

Participant in Quiz B
```

---

# 16. Project Ownership

Projects belong to the creator.

Conceptually:

```text
User
 ↓
Project
 ↓
Quizzes
```

For MVP:

```text
Project.ownerUserId
```

controls management access.

Future co-hosts may introduce a membership table.

---

# 17. Quiz Authorization

Only the quiz creator may:

- edit quiz,
- publish quiz,
- start quiz,
- choose questions,
- show leaderboard,
- change late-join setting,
- end quiz.

Backend must enforce this.

Frontend controls alone are insufficient.

---

# 18. Participant Authorization

A participant should only interact with live sessions for quizzes they are permitted to join.

Conceptually:

```text
User
  ↓
Quiz Registration
  ↓
Live Session
```

The backend validates registration and live-join rules before allowing participation.

---

# 19. REST API Architecture

REST handles persistent and CRUD-oriented functionality.

Conceptually:

```text
/api/auth/*

/api/users/*

/api/projects/*

/api/quizzes/*

/api/questions/*

/api/registrations/*

/api/results/*

/api/storage/*
```

Exact endpoint definitions belong in the API Design document.

---

# 20. REST Layer Responsibilities

REST controllers should perform:

```text
Authentication
Authorization
Input parsing
Zod validation
Calling services
Error mapping
Returning HTTP response
```

Business logic remains in services.

---

# 21. Realtime Architecture

Realtime communication uses:

```text
Socket.IO
```

The realtime system is responsible for:

- Participant connection
- Host connection
- Quiz rooms
- Question publishing
- Answer acknowledgement
- Live distribution updates
- Result state
- Leaderboard presentation
- Reconnection
- Session synchronization
- Quiz completion

---

# 22. Socket Room Model

Each live quiz receives its own Socket.IO room.

Conceptually:

```text
quiz:{liveSessionId}
```

Optional additional rooms:

```text
quiz:{sessionId}:host

quiz:{sessionId}:participants
```

This allows events to be selectively broadcast.

---

# 23. Live Quiz State Machine

The live session should use an explicit state machine.

Primary states:

```text
LOBBY

QUESTION_ACTIVE

QUESTION_RESULT

LEADERBOARD

COMPLETED
```

Conceptually:

```text
LOBBY
  ↓
QUESTION_ACTIVE
  ↓
QUESTION_RESULT
  ├────→ LEADERBOARD
  │          ↓
  └────→ QUESTION_ACTIVE
             ↓
          ...
             ↓
          COMPLETED
```

Invalid transitions must be rejected by the backend.

---

# 24. Redis as Realtime State Store

Redis is the primary store for fast-changing live-session state.

Example conceptual data:

```text
quiz:{sessionId}:state

quiz:{sessionId}:activeQuestion

quiz:{sessionId}:presence

quiz:{sessionId}:distribution

quiz:{sessionId}:leaderboard
```

Exact key naming belongs in Redis design.

---

# 25. PostgreSQL vs Redis Responsibility

This boundary is critical.

## PostgreSQL

Permanent facts:

```text
Quiz exists

Question exists

Participant registered

Question was asked

Participant submitted answer

Points were awarded

Final result exists
```

## Redis

Temporary operational state:

```text
Quiz is currently showing Q5

Q5 ends at timestamp X

187 users are connected

Option B currently has 92 responses

Leaderboard cache

Host currently shows leaderboard
```

---

# 26. Redis is Not the Permanent Database

Redis loss should not destroy permanent quiz results.

The system should remain recoverable using PostgreSQL data where practical.

Therefore:

```text
Redis = operational realtime state

PostgreSQL = durable source of truth
```

---

# 27. Live Quiz Start Flow

```text
Host
 ↓
Start Quiz
 ↓
REST / Socket Command
 ↓
Authorize Host
 ↓
Create / Activate Live Session
 ↓
Initialize Redis State
 ↓
Broadcast quiz_started
```

---

# 28. Question Start Flow

```text
Host selects Question
        ↓
Validate Host
        ↓
Validate Question belongs to Quiz
        ↓
Validate Question not previously completed
        ↓
Create AskedQuestion record
        ↓
Determine Duration
        ↓
Set startedAt
        ↓
Set endsAt
        ↓
Store Active State in Redis
        ↓
Broadcast question_started
        ↓
Participant Timer Begins
```

---

# 29. Timer Architecture

The participant browser does not own the timer.

Server stores:

```text
startedAt

endsAt
```

Participant receives `endsAt`.

UI computes:

```text
remainingTime =
endsAt - currentServerAlignedTime
```

At submission time:

```text
Server Timestamp
```

determines whether the answer is valid.

Changing JavaScript locally must not allow additional time.

---

# 30. Answer Submission Flow

```text
Participant
     ↓
submit_answer
     ↓
Authenticate Socket
     ↓
Validate Live Session
     ↓
Validate Active Question
     ↓
Validate Participant Eligibility
     ↓
Check Existing Submission
     ↓
Validate Server Time < endsAt
     ↓
Validate Answer
     ↓
Calculate Correctness
     ↓
Calculate Score
     ↓
Persist Submission in PostgreSQL
     ↓
Update Redis Aggregates
     ↓
Update Redis Leaderboard
     ↓
Acknowledge Submission
```

The answer should be considered accepted only after the server successfully records it.

---

# 31. Submission Idempotency

A participant may only have one submission for one asked question.

Database-level uniqueness should enforce something equivalent to:

```text
liveSessionId
+
askedQuestionId
+
userId
```

Duplicate submission attempts should return the original accepted state or a deterministic rejection.

---

# 32. Answer Locking

Once accepted:

```text
SUBMITTED
```

the answer cannot change.

Neither:

- reconnect,
- refresh,
- new browser tab,
- second device

should allow another answer.

---

# 33. Live Answer Distribution

During an active MCQ:

```text
Participant submissions
          ↓
Redis counters
          ↓
Host distribution
```

Example:

```text
A → 42
B → 31
C → 19
D → 8
```

Percentages are calculated from aggregated counts.

---

# 34. Distribution Visibility

While timer is active:

```text
Host        → CAN see percentages

Participant → CANNOT see percentages
```

After timer expiry:

```text
Participant → CAN see final distribution
```

The backend must enforce this.

Do not merely hide the frontend component.

---

# 35. Correct Answer Security

The correct answer should not be sent to participant clients before question expiry.

Avoid:

```text
question_started payload {
    ...
    correctAnswer: "B"
}
```

even if the UI hides it.

Correct answer remains backend/host-only until result state.

---

# 36. Question Expiry

When:

```text
currentTime >= endsAt
```

the question becomes closed.

Then:

```text
QUESTION_ACTIVE
        ↓
QUESTION_RESULT
```

Server:

1. Rejects new answers
2. Determines not-attempted users where needed
3. Finalizes distribution
4. Calculates ranks
5. Broadcasts question result

---

# 37. Scoring Architecture

Scoring should exist in a dedicated domain service.

Example:

```text
Answer Service
       ↓
Scoring Service
       ↓
Score
```

The scoring formula should not be scattered throughout:

- controllers,
- socket handlers,
- frontend components.

---

# 38. Scoring Inputs

For scored questions:

```text
Correctness

Question Duration

Question Start Time

Participant Submission Time

Maximum Question Score
```

---

# 39. Continuous Time-Based Score

Conceptually:

```text
Incorrect
→ 0

Not Attempted
→ 0

Correct
→ time-adjusted score
```

Faster correct answers receive more points.

The exact formula belongs in scoring design.

---

# 40. Multiple-Answer Questions

Scoring rule:

```text
All correct selections
+
No incorrect selections
=
Correct
```

Anything else:

```text
Incorrect
```

No partial scoring in MVP.

---

# 41. Descriptive Questions

Descriptive questions:

```text
Score = 0
```

Responses are saved permanently in PostgreSQL.

For host display, newly submitted responses can be broadcast through the live session.

---

# 42. Leaderboard Architecture

Live leaderboard uses Redis for fast ranking.

A suitable conceptual Redis data structure is:

```text
Sorted Set
```

Example:

```text
quiz:{sessionId}:leaderboard
```

where:

```text
member = participantId

score = accumulated quiz score
```

---

# 43. Persisted Results

Redis leaderboard is operational.

Final results must be written to PostgreSQL.

When quiz ends:

```text
Redis Live Leaderboard
        ↓
Finalize Results
        ↓
PostgreSQL QuizResult
```

Participants can later load results without Redis.

---

# 44. Ranking Ties

Participants with identical total score share the same rank.

Example:

```text
#1 Rahul — 8420
#1 Priya — 8420
#3 Arjun — 8310
```

---

# 45. Asked Questions Architecture

A quiz may contain:

```text
20 Questions
```

but the host may only ask:

```text
12 Questions
```

Therefore a separate concept is required:

```text
QuizQuestion
        ↓
AskedQuestion
```

`AskedQuestion` represents a question actually used during a specific live session.

Final scoring uses only AskedQuestion records.

---

# 46. Late Join Architecture

Host controls:

```text
allowLateJoin
```

When participant attempts to join:

```text
Authenticated User
       ↓
Quiz Registration
       ↓
Live Session
       ↓
Check allowLateJoin
       ↓
Join Current Session
```

If a question is active:

```text
Participant receives existing endsAt
```

not a new timer.

---

# 47. Participant Presence

Presence belongs in Redis.

Conceptually:

```text
quiz:{sessionId}:participants
```

Stores realtime information such as:

```text
userId
connectionId
connectedAt
lastSeenAt
```

Persistent registration remains in PostgreSQL.

---

# 48. Reconnection Architecture

Socket.IO reconnects transport automatically where possible.

After reconnect:

```text
Client
 ↓
Reconnect
 ↓
Authenticate
 ↓
Identify Live Session
 ↓
Read Authoritative Redis State
 ↓
Send session_state_sync
```

Client should not guess its previous screen.

---

# 49. Reconnection During Question

If:

```text
currentTime < endsAt
```

participant returns to active question.

If they previously submitted:

```text
Answer remains locked
```

If not:

```text
They may submit during remaining time.
```

---

# 50. Multiple Device Handling

One active participation session per user per quiz.

Recommended MVP behavior:

```text
Newest active connection replaces previous active connection.
```

Conceptually:

```text
Device A connected
        ↓
Device B connects
        ↓
Device A invalidated
```

---

# 51. Socket Authentication

A Socket.IO connection must authenticate.

Conceptually:

```text
Socket Connection
       ↓
Auth Credentials
       ↓
Verify User
       ↓
Associate userId
       ↓
Join Authorized Quiz Room
```

Never trust:

```text
userId
```

directly supplied by client event payloads.

---

# 52. Socket Authorization

Every sensitive socket action must verify authorization.

Example:

```text
host:show_leaderboard
```

requires:

```text
socket.userId
==
quiz.creatorUserId
```

The same applies to:

- start quiz,
- select question,
- end quiz,
- toggle late joining.

---

# 53. Redis Pub/Sub and Socket.IO Scaling

As horizontal scaling becomes necessary:

```text
API Instance A
       │
       ├──── Redis ────┐
       │               │
API Instance B         │
       │               │
       └───────────────┘
```

Socket.IO can use Redis-based coordination so instances share room events.

This is one reason Redis is included from the beginning.

---

# 54. Distributed Locks

Certain operations should not execute simultaneously.

Examples:

```text
Start same question twice

End quiz twice

Finalize results twice

Register final available capacity twice
```

Redis may provide short-lived distributed locks where appropriate.

Database uniqueness/transactions should still provide durable integrity.

---

# 55. Registration Capacity

Quiz has:

```text
registrationLimit
```

Registration must prevent overbooking.

Example race:

```text
Limit = 500

Request A sees 499
Request B sees 499

Both create registration
→ 501
```

PostgreSQL transaction or locking strategy should prevent this.

Redis alone should not be relied upon for permanent capacity integrity.

---

# 56. PostgreSQL Architecture

PostgreSQL is hosted through Supabase.

Application backend connects through Prisma.

Conceptually:

```text
Express
  ↓
Prisma
  ↓
PostgreSQL
  ↓
Supabase
```

---

# 57. Connection Management

Backend should use appropriate connection reuse/pooling.

Avoid:

```text
Request
 ↓
Open Fresh DB Connection
 ↓
Query
 ↓
Close
```

Prefer:

```text
Application
      ↓
Prisma
      ↓
Connection Pool
      ↓
Supabase PostgreSQL
```

Exact Vercel/Supabase connection configuration belongs in deployment design.

---

# 58. Database Design Philosophy

Core entities will likely include equivalents of:

```text
User

Session

Project

ProjectAssociation

Quiz

Question

QuestionOption

QuizRegistration

LiveQuizSession

AskedQuestion

AnswerSubmission

QuizResult
```

Exact schema belongs in the database design.

---

# 59. Transaction Boundaries

PostgreSQL transactions should be used when multiple persistent changes must succeed together.

Examples:

## Registration

```text
Check Capacity
+
Create Registration
```

## Start Question

Potentially:

```text
Create AskedQuestion
+
Update persistent session state
```

## Quiz Completion

```text
Finalize Session
+
Persist Results
```

Not every operation requires a transaction.

---

# 60. Supabase Storage Architecture

Actual image files should not be stored inside PostgreSQL.

Architecture:

```text
PostgreSQL
     ↓
File Metadata / Storage Path

Supabase Storage
     ↓
Actual Image Binary
```

Possible assets:

- User profile image
- Project cover
- Quiz cover
- Question image

---

# 61. Direct Upload Architecture

Large image bodies should not unnecessarily pass through the Express backend.

Avoid:

```text
Browser
 ↓
Express
 ↓
Supabase Storage
```

Prefer:

```text
Browser
       ↓
Request Upload Permission
       ↓
Express API
       ↓
Create Signed Upload Permission
       ↓
Browser
       ↓
Direct Upload
       ↓
Supabase Storage
```

---

# 62. Image Upload Flow

```text
User
 ↓
POST upload-request
 ↓
Authenticate
 ↓
Authorize Quiz / Project Ownership
 ↓
Validate Metadata
 ↓
Generate Signed Upload Permission
 ↓
Return Upload Details
 ↓
Browser Uploads Directly
 ↓
Upload Success
 ↓
Notify Backend
 ↓
Persist Storage Path
```

---

# 63. Upload Security

Backend should validate:

- MIME type
- Maximum file size
- Allowed use case
- User authorization
- Quiz/project ownership
- Upload permission expiry

Client should never receive broad storage administrator credentials.

---

# 64. Storage Abstraction

Business code should not depend on Supabase SDK calls everywhere.

Prefer:

```text
Quiz Service
     ↓
StorageService
     ↓
SupabaseStorageAdapter
     ↓
Supabase Storage
```

This allows future migration to another provider without rewriting the whole application.

---

# 65. Next.js Architecture

Next.js remains responsible for the web experience.

Use:

- Server Components where appropriate
- Client Components for interactivity
- SSR where valuable
- Next.js routing
- Layouts
- Tailwind CSS

---

# 66. Server Components

Server Components may call the Express backend for initial page data.

Example:

```text
Dashboard Server Component
           ↓
Express API
           ↓
PostgreSQL
```

This preserves server-rendered UX without coupling the UI directly to the database.

---

# 67. Client Components

Client Components are expected for:

- Quiz answering
- Live timer
- Socket.IO connection
- Host controls
- Leaderboard transitions
- Live distributions
- Interactive forms

---

# 68. Frontend State Philosophy

Persistent business state should primarily come from backend APIs.

Realtime state should primarily come from Socket.IO.

Local state should manage presentation.

Avoid creating a second client-side source of truth for live quiz state.

Conceptually:

```text
Server State
     ↓
Socket / API
     ↓
UI State
```

not:

```text
Browser invents live state
```

---

# 69. API Validation

Zod validates all untrusted external input.

Examples:

- Signup
- Login
- Project creation
- Quiz creation
- Question creation
- Registration
- Image metadata
- Socket payloads

Validation occurs at system boundaries.

---

# 70. Error Architecture

Errors should map into consistent categories.

Example:

```text
VALIDATION_ERROR

UNAUTHENTICATED

FORBIDDEN

NOT_FOUND

CONFLICT

QUIZ_FULL

QUIZ_NOT_LIVE

QUESTION_CLOSED

ALREADY_SUBMITTED

RATE_LIMITED

INTERNAL_ERROR
```

Internal stack traces must not be exposed to clients.

---

# 71. Logging

MVP logging sources:

- Express application logs
- Next.js logs
- Vercel runtime logs
- Supabase operational logs
- Upstash operational information

Important log context may include:

```text
requestId
userId
quizId
liveSessionId
operation
errorCode
```

Never log:

- Passwords
- Refresh tokens
- Access tokens
- Storage credentials

---

# 72. Realtime Logging

Important realtime lifecycle events should be logged.

Examples:

```text
quiz_started

question_started

question_closed

participant_reconnected

answer_submission_failure

quiz_completed
```

Avoid logging every successful socket heartbeat.

---

# 73. Security Architecture

Primary areas:

1. Authentication
2. Authorization
3. Password security
4. Socket authentication
5. Correct-answer secrecy
6. Score integrity
7. Timer integrity
8. Upload security
9. Rate limiting
10. Secret management
11. Input validation
12. Database integrity

---

# 74. Competitive Integrity

The participant client must not control:

```text
isCorrect

points

rank

questionEndTime

registration eligibility

quiz state
```

All competitive decisions are server-side.

---

# 75. Rate Limiting

Sensitive endpoints include:

```text
POST /api/auth/login

POST /api/auth/signup

POST /api/auth/refresh

POST /api/quizzes/:quizId/register

POST /api/storage/upload-request
```

Sensitive Socket.IO actions include:

```text
submit_answer

join_live_session

host_start_quiz

host_start_question
```

Redis is suitable for distributed rate-limit counters.

---

# 76. Secret Management

Sensitive values must exist only in server-side environment configuration.

Examples:

```text
DATABASE_URL

DIRECT_DATABASE_URL

REDIS_URL

SUPABASE_SERVICE_ROLE_KEY

SUPABASE_STORAGE_BUCKET

JWT / access-token secret or signing key

Refresh-token secret

Allowed Origins
```

These values must never be exposed in frontend bundles.

---

# 77. CORS and Origin Policy

Because the web and API may deploy separately, the Express backend must use an explicit CORS policy.

Allow only approved origins such as:

```text
Local Web Development Origin

Production Web Origin

Approved Preview Origins if intentionally supported
```

Socket.IO origin rules should align with REST CORS policy.

---

# 78. CSRF Considerations

If browser authentication uses cookies, state-changing REST requests require an appropriate CSRF strategy.

Potential options include:

- SameSite cookie protections
- Origin validation
- CSRF token where required

Exact implementation belongs in Security Design.

---

# 79. Performance Strategy

Initial performance work should focus on:

- Proper PostgreSQL indexes
- Efficient Prisma queries
- Pagination
- Redis for hot realtime state
- Direct storage uploads
- Server-authoritative aggregation
- Avoiding unnecessary socket broadcasts
- Minimal payload sizes

Premature advanced optimization should be avoided.

---

# 80. Pagination

Large historical collections should not be loaded without bounds.

Likely candidates:

```text
Completed quizzes

Quiz registrations

Participant histories

Host result lists
```

Example:

```text
GET /api/quizzes/:quizId/registrations?cursor=...

GET /api/history?cursor=...
```

Exact pagination style belongs in API design.

---

# 81. PostgreSQL Indexing

Indexes will likely be important for:

```text
users.email

projects.ownerUserId

quizzes.projectId

quizzes.creatorUserId

quizzes.status

quizzes.scheduledAt

registrations.quizId + userId

askedQuestions.liveSessionId

submissions.askedQuestionId + userId

results.liveSessionId

results.userId
```

Exact composite indexes should be based on real query patterns.

---

# 82. Redis Expiration Strategy

Temporary live-session keys should not remain forever.

Live-state keys should receive appropriate TTLs after quiz completion.

Example concept:

```text
Live quiz keys
   ↓
Quiz completes
   ↓
Keep temporarily for recovery/debugging
   ↓
Expire automatically
```

Exact TTL duration belongs in Redis design.

---

# 83. Deployment Architecture

Production:

```text
                              Internet
                                 │
                 ┌───────────────┴───────────────┐
                 │                               │
                 ▼                               ▼
          ┌──────────────┐                ┌──────────────┐
          │    Vercel    │                │    Vercel    │
          │              │                │              │
          │ Next.js Web  │                │ Express API  │
          └──────┬───────┘                └──────┬───────┘
                 │                               │
                 │                     REST + Socket.IO
                 │                               │
                 └───────────────────────────────┘
                                                 │
                     ┌───────────────────────────┼────────────────────┐
                     │                           │                    │
                     ▼                           ▼                    ▼
             Supabase Postgres              Upstash Redis      Supabase Storage
```

---

# 84. Vercel Portability Rule

The Express backend should remain standard Node.js / Express code as much as practical.

Avoid deep coupling to Vercel-only application APIs.

Reason:

```text
If realtime hosting requirements change later:

Express API
    ↓
Railway / Render / Fly / another Node host
```

should be possible without major business-logic rewrites.

---

# 85. Environment Separation

At minimum:

```text
Local Development

Production
```

Recommended when practical:

```text
Preview / Staging
```

Production data and credentials must remain isolated from local development.

---

# 86. Development Infrastructure

For local development:

```text
Next.js
Express
Local or development Supabase project
Development Upstash Redis
Development Supabase Storage bucket
```

Production credentials must not be used accidentally in local development.

---

# 87. Scaling Strategy

Scaling should be incremental.

## Stage 1 — MVP / Portfolio

```text
Next.js → Vercel

Express → Vercel

PostgreSQL → Supabase

Redis → Upstash

Storage → Supabase
```

Target:

```text
~500 participants in one quiz
```

Load-test this target before claiming support.

## Stage 2 — Increased Usage

Optimize:

- SQL queries
- Database indexes
- Redis command usage
- Socket payload sizes
- Realtime broadcast frequency
- Connection limits
- Storage delivery
- Rate limits

## Stage 3 — Horizontal Realtime Scaling

If API instances increase:

```text
Socket.IO
+
Redis Adapter
+
Redis Pub/Sub
```

Coordinate events across instances.

## Stage 4 — Significant Scale

Only when justified consider:

- Dedicated realtime deployment
- Dedicated workers
- Separate background-job infrastructure
- Read replicas
- Dedicated Redis tier
- More specialized observability
- Domain extraction from the monolith

Microservices remain a response to demonstrated need, not an MVP goal.

---

# 88. Failure Handling

The system must assume dependencies can fail.

Examples:

- PostgreSQL temporarily unavailable
- Redis unavailable
- Supabase Storage failure
- Socket disconnect
- Vercel instance restart
- Host disconnect
- Participant network failure

Failures should degrade predictably.

---

# 89. PostgreSQL Failure

If durable answer persistence fails:

```text
Participant Submission
      ↓
Database Failure
      ↓
Do not confirm answer as accepted
      ↓
Return / emit error
      ↓
Allow safe retry while question remains open
```

The client must not display a submission as final unless the server confirms acceptance.

---

# 90. Redis Failure

Redis failure is especially important because live state depends on it.

If Redis becomes unavailable:

- persistent quiz data remains safe in PostgreSQL,
- new realtime state transitions may be temporarily unavailable,
- server should avoid silently running divergent in-memory state,
- active quiz may need to show a recoverable temporary error.

Future hardening can add more sophisticated recovery.

For MVP:

> Prefer a visible temporary interruption over inconsistent scoring.

---

# 91. Socket Disconnect

Participant disconnect should not remove:

- Registration
- Submitted answers
- Earned score

On reconnect:

```text
Authenticate
 ↓
Resolve Session
 ↓
Restore State
```

---

# 92. Host Disconnect

Host disconnect should **not automatically end the quiz**.

Recommended behavior:

```text
Host disconnects
      ↓
Live session remains stored
      ↓
Participants remain on current authoritative state
      ↓
Host reconnects
      ↓
Host control restored
```

If a question is already active, its server timer continues.

---

# 93. Supabase Storage Failure

If direct upload fails:

- do not persist image as successfully attached,
- show upload failure,
- allow retry.

If upload succeeds but metadata persistence fails, an orphaned object may exist.

A future cleanup mechanism may remove old unreferenced objects.

---

# 94. Data Consistency

Durable state transitions should favor PostgreSQL integrity.

Examples:

```text
Registration capacity

Single answer per participant per asked question

Single final result per participant per live session

Quiz ownership

Asked-question history
```

Redis improves performance and realtime coordination but should not weaken database integrity.

---

# 95. Realtime Consistency Model

Not every realtime metric needs transactional precision at every millisecond.

For example:

```text
Host live distribution
```

may be eventually updated over very short intervals.

However:

```text
Accepted answer
Points awarded
Final result
```

must be correct and durable.

This distinction allows efficient realtime UX without compromising competitive results.

---

# 96. Answer Distribution Broadcasting

For 500 participants, broadcasting on every individual answer may generate unnecessary updates.

An implementation may throttle host distribution broadcasts.

Example:

```text
Many submissions
      ↓
Redis counters update immediately
      ↓
Host UI broadcast every ~100–500ms
```

Exact interval should be tested.

Participants still receive only final distribution after question expiry.

---

# 97. Quiz Completion Flow

```text
Host
 ↓
End Quiz
 ↓
Acquire Completion Guard / Lock
 ↓
Validate Host
 ↓
Prevent New Questions
 ↓
Read Asked Questions
 ↓
Finalize Participant Totals
 ↓
Calculate Final Rankings
 ↓
Persist Quiz Results
 ↓
Mark Live Session COMPLETED
 ↓
Update Redis State
 ↓
Broadcast quiz_ended
```

Unused questions are ignored.

---

# 98. Final Leaderboard Reveal

Quiz completion and leaderboard presentation are separate concepts.

```text
Quiz Completed
      ↓
Final Results Persisted
```

The host may then choose when to display:

```text
Top 10 Final Leaderboard
```

Participants do not automatically switch to it unless host chooses.

---

# 99. QR Code Architecture

QR codes simply encode the stable public quiz URL.

Example:

```text
https://app.example.com/quiz/abc123
```

The QR image does not need to be permanently stored.

It may be generated dynamically whenever requested.

This keeps QR handling lightweight.

---

# 100. Public Quiz Identifier

Shared quiz URLs should use a stable non-sequential public identifier.

Avoid:

```text
/quiz/1
/quiz/2
/quiz/3
```

Prefer:

```text
/quiz/k7F9xP2...
```

or another stable public ID/slug strategy.

The public identifier is not a substitute for authorization.

---

# 101. Scheduled Quiz Architecture

A scheduled quiz stores:

```text
scheduledAt
```

The scheduled time is informational and controls upcoming-state presentation.

It does **not** automatically start the live quiz.

Only the host starts the session.

---

# 102. Project Association Architecture

When a participant registers for a quiz:

```text
Participant
    ↓
Quiz
    ↓
Project
```

the backend may create project association if one does not already exist.

This allows future project quizzes to appear in participant dashboards.

---

# 103. Background Jobs

No dedicated background worker framework is required initially.

MVP does not require:

- BullMQ
- RabbitMQ
- Kafka

If later features introduce:

- emails,
- scheduled reminders,
- heavy report generation,

a background job architecture can be introduced.

Redis should not be turned into a job queue unless a real product need exists.

---

# 104. Observability

MVP starts with:

- Structured application logging
- Vercel logs
- Supabase monitoring
- Upstash monitoring

No mandatory external observability platform initially.

Later candidates may include:

- Sentry
- OpenTelemetry
- Datadog
- Grafana
- PostHog

Architecture should not prevent adding them.

---

# 105. Testing Considerations

Architecture should support:

## Unit Tests

Examples:

- Scoring formula
- Quiz state transitions
- Authorization helpers
- Ranking logic
- Multiple-answer correctness

## Integration Tests

Examples:

- REST API + PostgreSQL
- Registration capacity
- Answer persistence
- Quiz completion

## Realtime Integration Tests

Examples:

- Host starts question
- Participant receives question
- Participant submits
- Host receives distribution
- Question expires
- Result is broadcast

## End-to-End Tests

Critical flow:

```text
Signup
→ Create Project
→ Create Quiz
→ Publish
→ Register Participants
→ Open Lobby
→ Start Quiz
→ Ask Question
→ Submit Answers
→ Show Result
→ Show Leaderboard
→ Ask Next Question
→ End Quiz
→ View Final Results
```

---

# 106. Critical Security Tests

Testing must explicitly verify:

```text
Participant cannot start quiz.

Participant cannot choose next question.

Non-owner cannot edit another host's quiz.

Participant cannot submit twice.

Participant cannot submit after server expiry.

Participant cannot fetch correct answer early.

Participant cannot fetch live percentages early.

Client cannot submit custom points.

Client cannot manipulate rank.

Unregistered user cannot bypass join rules.

Quiz registration cannot exceed capacity.

Second device cannot create a second active participation identity.
```

---

# 107. Load Testing

Before MVP is considered ready for the stated scale, test at approximately:

```text
500 concurrent participants
```

Important scenarios:

```text
500 participants connect to one room

Host starts question

Large burst of answer submissions

Host distribution updates

Question expiry broadcast

Leaderboard calculation

Participant reconnections
```

Performance claims should be based on actual load tests, not assumptions.

---

# 108. Important Architectural Decisions

## ADR-01: Modular Monolith

**Decision:** Use one backend application with domain modules.

**Reason:** Product complexity does not justify microservices.

---

## ADR-02: Separate Next.js Frontend and Express Backend

**Decision:** Use Next.js for web and Express for backend APIs/realtime.

**Reason:** Clean client/backend boundary, realtime flexibility and future React Native compatibility.

---

## ADR-03: REST + Socket.IO

**Decision:** Use REST for normal business operations and Socket.IO for live session communication.

**Reason:** Each protocol is used where it fits naturally.

---

## ADR-04: PostgreSQL

**Decision:** Use PostgreSQL instead of MongoDB.

**Reason:** Product data is strongly relational and benefits from relational integrity, constraints and transactions.

---

## ADR-05: Supabase PostgreSQL

**Decision:** Use Supabase as managed PostgreSQL provider for MVP.

**Reason:** Low operational overhead and free/low-cost starting point.

---

## ADR-06: Prisma

**Decision:** Use Prisma as ORM.

**Reason:** Strong developer experience, readable relational model and suitability for the product's entity relationships.

---

## ADR-07: Redis from V1

**Decision:** Use Redis from the start.

**Reason:** Realtime presence, ephemeral state, leaderboard caching, rate limiting, distributed coordination and future horizontal Socket.IO scaling are genuine platform needs.

---

## ADR-08: Upstash Redis

**Decision:** Use Upstash Redis initially.

**Reason:** Managed, serverless-friendly and suitable for low-cost MVP infrastructure.

---

## ADR-09: Custom Authentication

**Decision:** Own the authentication system rather than use Clerk/Auth0/Supabase Auth.

**Reason:** Cost control, learning value, portability and control.

**Constraint:** Use established cryptographic libraries and secure auth patterns.

---

## ADR-10: Access + Refresh Token Model

**Decision:** Authentication architecture should support both browser and future React Native clients.

**Reason:** Avoid redesigning auth when mobile arrives.

---

## ADR-11: Supabase Storage

**Decision:** Store media in Supabase Storage.

**Reason:** Already using Supabase, keeps MVP infrastructure simple and provides sufficient storage capabilities for quiz media.

---

## ADR-12: Direct-to-Storage Uploads

**Decision:** Browser uploads image bodies directly using narrow upload permissions.

**Reason:** Avoid routing file bodies through the application backend.

---

## ADR-13: Server-Authoritative Timer

**Decision:** Server timestamps determine question timing and submission validity.

**Reason:** Competitive integrity and consistent realtime behavior.

---

## ADR-14: Redis Live State + PostgreSQL Durable State

**Decision:** Redis owns temporary realtime operational state while PostgreSQL owns durable facts.

**Reason:** Combines fast realtime access with strong persistence and recovery.

---

## ADR-15: AskedQuestion Entity

**Decision:** Persist the distinction between created questions and questions actually asked.

**Reason:** Final scores depend only on questions used by the host.

---

## ADR-16: Vercel Hosting

**Decision:** Deploy both Next.js frontend and Express backend on Vercel for the initial version.

**Reason:** Low operational overhead and aligns with MVP infrastructure preference.

**Constraint:** Keep backend portable in case realtime hosting needs later justify moving it.

---

## ADR-17: pnpm + Turborepo

**Decision:** Use pnpm workspaces and Turborepo for the monorepo.

**Reason:** Shared packages, efficient development workflows and clear web/API separation.

---

# 109. Architecture Explicitly Excluded from V1

We will not initially use:

- Microservices
- NestJS
- GraphQL
- Kafka
- RabbitMQ
- BullMQ
- Kubernetes
- ECS
- Manual load balancers
- Docker requirement for production deployment
- Elasticsearch
- Clerk
- Auth0
- Better Auth
- Supabase Auth
- MongoDB
- Dedicated realtime microservice
- Dedicated worker service
- Custom image-processing service
- Advanced observability platform
- Product analytics platform
- Complex anti-cheating infrastructure
- Event sourcing
- CQRS architecture

---

# 110. Final System Summary

The Live Quiz Platform V1 will operate as a **TypeScript modular-monolith backend with a separate Next.js frontend and Express backend**, maintained inside one pnpm/Turborepo monorepo.

The Next.js application provides the web experience, while Express exposes explicit REST APIs and Socket.IO realtime communication.

PostgreSQL hosted on Supabase is the durable system of record for users, projects, quizzes, questions, registrations, asked questions, answer submissions and final results.

Upstash Redis handles ephemeral live-session state including presence, current quiz state, active question timing, answer-distribution counters, leaderboard cache, rate limiting and realtime coordination.

Supabase Storage stores quiz and project media through direct browser uploads with server-authorized upload permissions.

Authentication is owned by the application using established password hashing and a token/session architecture designed to support both the Next.js web client and a future React Native application.

Realtime competitive state is server-authoritative. Participant browsers do not control question timing, correctness, score, rank or answer locking.

The initial system targets approximately **500 concurrent participants in a single live quiz**, while supporting multiple independent live quizzes across different hosts.

Frontend and backend will initially deploy to Vercel. The Express backend should remain portable so it can move to a dedicated Node hosting environment later if realtime scaling or platform constraints justify the change.

The system is deliberately optimized for:

> **Realtime reliability, simple managed infrastructure, strong domain boundaries, competitive integrity, low initial cost, mobile-client compatibility and incremental scalability without premature microservices.**

---

**End of System Design Architecture Document**
