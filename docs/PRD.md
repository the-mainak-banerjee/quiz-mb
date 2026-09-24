# Live Quiz Platform — MVP Product Requirements Document (PRD)

**Document type:** AI-build-ready PRD  
**Format:** Markdown  
**Status:** MVP Scope Locked  
**Primary implementation approach:** Build phase-by-phase. Do **not** attempt the full MVP in one pass.

---

## 1. Product Summary

The product is a host-controlled live quiz platform where users can:

- create accounts,
- create projects,
- create quizzes inside projects,
- schedule or immediately run quizzes,
- share quiz links and QR codes,
- register participants,
- run live questions one at a time,
- score participants using correctness + response speed,
- display live answer distribution to the host,
- optionally show a Top 10 leaderboard,
- save final results and quiz history.

The platform is intentionally **host-controlled**.

Questions do not autoplay. The host decides when the next question is sent, whether to keep the previous result screen visible, whether to show the leaderboard, and when to end the quiz.

---

# 2. MVP Product Principles

The MVP should follow these rules:

1. **Simple first.**
   Avoid features that increase complexity without proving the core live-quiz experience.

2. **Host controls the room.**
   The host controls question progression, leaderboard visibility, late joining, and ending the quiz.

3. **Real-time reliability matters.**
   Reconnection and state recovery are part of MVP because the product depends on live interaction.

4. **Fairness matters.**
   Participants cannot change an answer once submitted. Live answer percentages are visible to the host while a question is active, but not to participants until time expires.

5. **Build incrementally.**
   Each phase below should be completed and validated before starting the next phase.

---

# 3. Core Product Hierarchy

```text
User
└── Project
    └── Quiz
        ├── Questions
        ├── Registrations
        ├── Live Session
        └── Results / Leaderboard
```

A single user account can act as both:

- Host / Quiz Creator
- Participant

---

# 4. User Roles

## 4.1 Host

A host can:

- create projects,
- create quizzes,
- add questions,
- schedule quizzes,
- publish quizzes,
- share links and QR codes,
- see registered participants,
- start a live quiz,
- choose which question is asked next,
- see live answer distribution,
- optionally display the leaderboard,
- end the quiz,
- view completed quiz results.

For MVP, only the quiz creator can control the live session.

---

## 4.2 Participant

A participant can:

- create/login to an account,
- join/register for a quiz,
- enter via dashboard or shared link,
- wait in the lobby,
- participate in live questions,
- submit answers,
- see their answer result,
- see points earned,
- see their current rank,
- see answer distribution after the timer ends,
- see final score/rank/history.

---

# 5. Authentication

## 5.1 MVP

Support:

- Email signup
- Email login
- Logout
- Basic user profile
- Real name

A user's real name is shown on the leaderboard.

## 5.2 Not required in initial MVP

- Mobile OTP
- Social login
- SSO
- Anonymous participation

These can be added later.

---

# 6. Projects

Hosts organize quizzes inside projects.

Example:

```text
Project: Weekly Product Club
├── Quiz 1
├── Quiz 2
└── Quiz 3
```

A participant who joins a quiz belonging to a project becomes associated with that project.

Future scheduled quizzes from the same project should appear on that participant's dashboard.

---

# 7. Quiz Lifecycle

A quiz can have the following states:

```text
DRAFT
→ PUBLISHED / SCHEDULED
→ LOBBY
→ LIVE
→ COMPLETED
```

## 7.1 Draft

- Only the host can access it.
- Host can add/edit quiz details and questions.

## 7.2 Published / Scheduled

- Quiz can accept registrations.
- Quiz has a shareable link and QR code.
- Scheduled quizzes display their date/time.
- Scheduled time does **not** automatically start the quiz.

## 7.3 Lobby

- Host has opened the live room.
- Participants wait for the host to start.

## 7.4 Live

- Host controls question progression.
- Real-time submissions and scoring occur.

## 7.5 Completed

- No more questions can be asked.
- Final score/rank is saved.
- Results appear in participant and host history.

---

# 8. Quiz Creation

A host creates a quiz inside a project.

Required/available fields:

- Quiz title
- Description
- Optional cover image
- Maximum participant capacity
- Default question duration
- Optional scheduled date/time
- Questions
- Quiz status

The host can either:

- publish/start now,
- schedule for later.

---

# 9. Question Types

MVP supports three question types.

## 9.1 Single-choice MCQ

- Multiple options
- Exactly one correct answer
- Automatically scored

## 9.2 Multiple-answer MCQ

- Multiple correct options possible
- Automatically scored
- All-or-nothing scoring

Participant receives points only when:

- every correct option is selected, and
- no incorrect option is selected.

No partial marks in MVP.

## 9.3 Descriptive Question

- Free-text response
- Not graded
- No points
- Does not affect the leaderboard

The host can see submitted descriptive responses.

Responses should be shown as anonymous/random response cards rather than prominently associating each response with the participant who submitted it.

## 9.4 Images

An image can be attached to any question.

Do not create a separate "image question" type.

---

# 10. Question Timing

Every quiz has a default question duration.

Example:

```text
Default duration: 20 seconds
```

That duration applies automatically to all questions unless overridden.

Example:

```text
Q1: 20 seconds
Q2: 20 seconds
Q3: 45 seconds
Q4: 20 seconds
```

MVP rules:

- Timer begins immediately when the host sends the question.
- Host cannot stop an active question early.
- No separate pause button is required.

---

# 11. Registration and Access

Every published quiz receives:

- Unique URL
- QR code

There is **no password-protected quiz feature in MVP**.

Participants can join via:

- shared link,
- QR code,
- dashboard.

If the participant is not logged in:

```text
Quiz link
→ Login / Signup
→ Return to the same quiz
```

---

# 12. Capacity Rules

Host sets a maximum registration limit.

Example:

```text
Maximum registrations: 500
```

Capacity is based on **registrations**, not concurrent attendance.

If 500 users register, registration closes.

If only 350 initially attend, the other 150 places do not become publicly available simply because those users are absent.

This avoids overbooking if registered users join later.

Before the quiz begins, a participant may unregister.

When a participant unregisters before the quiz starts, that registration slot becomes available again.

---

# 13. Lobby

## 13.1 Participant Lobby

Participant sees:

- Quiz title
- Project name
- Host / organizer
- Scheduled time if relevant
- Waiting state
- Basic live-session status

Example:

```text
Waiting for the host to start the quiz...
```

## 13.2 Host Lobby

Host sees:

- Registered participant count
- Connected participant count
- Participant list
- Start Quiz button

The quiz does not start automatically.

---

# 14. Host-Controlled Live Session

There is **no autoplay between questions**.

Host controls the sequence.

The host may select any unanswered question.

Questions do not need to follow creation order.

Example:

```text
Created:
Q1 → Q2 → Q3 → Q4 → Q5

Asked:
Q1 → Q3 → Q5 → Q2
```

A skipped question remains available for later.

Completed questions cannot be reopened/replayed in MVP.

---

# 15. Starting a Question

Before sending a question, the host privately sees:

- Question text
- Options
- Correct answer
- Timer
- Question status

When the host selects the next question:

1. The question is immediately published to participants.
2. The countdown timer starts immediately.

Do not add an extra "prepare/start question" confirmation in MVP.

---

# 16. Answer Submission

During an active question:

- Participant chooses an answer.
- Participant must explicitly press Submit.
- Submission is immediately locked.

Once submitted:

- participant cannot edit it,
- participant cannot resubmit,
- answer remains saved if connection is lost.

If the timer reaches zero without explicit submission:

```text
Status: NOT ATTEMPTED
Points: 0
```

A selected-but-not-submitted answer must **not** be automatically submitted.

---

# 17. Active Question — Participant Experience

While timer is active, participant sees:

- Question
- Options / descriptive input
- Countdown timer
- Submit button
- Submission confirmation after submitting

After submission and before timer expiry:

```text
Answer submitted
Waiting for the question to end...
```

Participants must **not** see answer distribution while other users are still answering.

---

# 18. Active Question — Host Experience

While an MCQ is active, host sees:

- Question
- Remaining time
- Number of submitted answers
- Number of pending answers
- Live answer distribution
- Live answer percentages

Example:

```text
A — 42%
B — 31%
C — 19%
D — 8%
```

This live distribution is host-only while the timer is active.

---

# 19. Timer Expiry and Automatic Reveal

When timer reaches zero:

1. New submissions stop.
2. Correct answer is automatically revealed for scored questions.
3. Points are calculated.
4. Rank is recalculated.
5. Final answer distribution becomes visible to participants.
6. Host remains in control of what happens next.

There is no separate "Reveal Answer" button.

---

# 20. Post-Question Participant Screen

For a scored question, participant sees:

- Their submitted answer
- Correct answer
- Correct / incorrect state
- Points earned for that question
- Current total score
- Current rank
- Total number of ranked participants
- Final answer distribution

Example:

```text
Your answer: B ❌
Correct answer: C ✅

Points earned: 0
Current score: 4,280
Rank: #250 of 500
```

For descriptive questions:

- participant sees their own submitted response,
- no correct answer,
- no points,
- leaderboard score is unchanged.

---

# 21. Post-Question Host Controls

After timer expiry, the quiz naturally waits for the host.

No separate Pause feature is required.

Host can choose:

## 21.1 Keep Question Visible

Participants continue seeing the result screen.

## 21.2 Show Leaderboard

Host can display the Top 10 leaderboard.

The host can choose whether:

- leaderboard appears only on the host display, or
- all participant screens switch to leaderboard.

## 21.3 Next Question

Host selects the next unanswered question.

The selected question:

- immediately appears,
- immediately starts its timer.

---

# 22. Leaderboard

Live leaderboard contains:

- Rank
- Participant real name
- Total score

MVP leaderboard size:

```text
Top 10
```

Participants always see their own personal rank after a scored question, even if they are outside Top 10.

Example:

```text
Your rank: #47 of 600
```

The full leaderboard is not automatically shown after every question.

The host decides when to show it.

---

# 23. Scoring Model

Scoring uses:

```text
Correctness + Response Speed
```

Speed directly affects points.

It is **not only a tiebreaker**.

A faster correct answer receives more points than a slower correct answer.

Conceptual model:

```text
Maximum points for question = Pmax

If answer is incorrect:
    score = 0

If answer is correct:
    score decreases continuously as response time increases
```

Example:

```text
Very fast correct answer → ~950 points
Medium correct answer    → ~730 points
Slow correct answer      → ~420 points
Incorrect                → 0
Not attempted            → 0
```

The exact scoring formula should be implemented as a configurable server-side constant/function, but the MVP UI does not expose custom scoring configuration.

---

# 24. Ranking and Ties

Primary ranking:

```text
Higher total score = higher rank
```

Because speed already affects the score, no additional speed-based tiebreaker is required.

If two participants have exactly the same total score, they can share the same rank.

Example:

```text
#1 Rahul — 8,420
#1 Priya — 8,420
#3 Arjun — 8,310
```

---

# 25. Final Score Uses Only Questions Actually Asked

This is a mandatory product rule.

The final score depends only on questions that the host actually asked during the live session.

Example:

```text
Quiz contains: 20 questions
Host asks: 12 questions

Final result is based only on those 12 questions.
```

The unused 8 questions:

- do not count as incorrect,
- do not count as not attempted,
- do not affect denominator/statistics,
- do not affect final score.

---

# 26. Late Joining

Late joining is host-controlled.

Host has:

```text
Allow New Participants: ON / OFF
```

While ON:

- registered participants can enter a live quiz.

When OFF:

- users who are not already in the session cannot enter.

A late participant joins the **currently active question**.

Example:

```text
Question originally had 20 seconds.
Participant joins with 8 seconds remaining.
Participant receives only those remaining 8 seconds.
```

No additional time is granted.

---

# 27. Missed Questions

Questions that occurred before the participant joined are recorded as:

```text
NOT ATTEMPTED
Points: 0
```

They are not counted as incorrect answers.

---

# 28. Reconnection

Real-time reconnection is required for MVP.

If a participant loses connection:

- app should attempt automatic reconnection,
- participant should return to the same live session,
- current session state should be restored.

If the current question still has time remaining:

- participant may answer using the remaining time.

If an answer was submitted before disconnection:

- submitted answer remains saved,
- participant cannot change it,
- scoring proceeds normally.

---

# 29. One Active Session Per Participant

A participant account can have only one active participation session for a given quiz.

The same account must not be able to participate simultaneously from multiple devices/tabs.

Implementation may:

- invalidate the older session, or
- reject the newer session.

Choose one behavior and keep it deterministic.

Recommended MVP behavior:

```text
Newest session replaces the previous active session.
```

---

# 30. Descriptive Question Host Experience

During a descriptive question:

- submitted responses appear on the host screen,
- responses can appear as cards / boxes,
- responses should not be ordered by participant identity,
- response content is the focus,
- no score is calculated.

The host can continue to receive responses until timer expiry.

---

# 31. Ending a Quiz

Host can end a quiz at any time.

The host is not required to ask every question.

When host selects:

```text
End Quiz
```

The system:

1. Ends the live session.
2. Uses only questions actually asked.
3. Calculates final results.
4. Saves final ranking.
5. Moves quiz to COMPLETED.

---

# 32. Final Leaderboard

The final leaderboard is **host-controlled**.

Ending the quiz does not automatically force the final leaderboard onto participant screens.

The host may:

- keep the current screen,
- speak/explain,
- then choose to reveal the final Top 10 leaderboard.

---

# 33. Participant Quiz History

After completion, participant can see:

- Quiz title
- Date
- Final score
- Final rank
- Correct count
- Incorrect count
- Not-attempted count

MVP does **not** include historical question-by-question answer review.

---

# 34. Host Completed Quiz View

Host should be able to see:

- Quiz summary
- Participant count
- Final leaderboard
- Participant scores
- Correct / incorrect / not-attempted totals

Advanced analytics are not required in MVP.

---

# 35. Dashboard Requirements

## 35.1 Participant Dashboard

Sections:

### Upcoming

- Registered future quizzes
- Upcoming quizzes belonging to projects the user has joined

### Live

- Registered quizzes currently live

### History

- Completed quizzes
- Score
- Rank
- Correct / incorrect / not-attempted count

## 35.2 Host Dashboard

Sections:

- Projects
- Draft quizzes
- Scheduled quizzes
- Live quiz
- Completed quizzes

Inside a project, host can see all quizzes belonging to that project.

---

# 36. Project Association

When a participant joins/registers for a quiz, associate the participant with the quiz's project.

Future scheduled quizzes from that project may appear automatically in the participant's dashboard.

MVP does not require a complex social "follow" system.

This can be represented internally as project membership / association.

---

# 37. Real-Time State Model

A live session should maintain a single authoritative server-side state.

Suggested states:

```text
LOBBY
QUESTION_ACTIVE
QUESTION_RESULT
LEADERBOARD
COMPLETED
```

Optional internal states are allowed, but clients should follow the server state.

Important:

- participants must not independently decide what screen comes next,
- host actions drive room state,
- reconnecting clients must receive the latest authoritative state.

---

# 38. Suggested Core Data Entities

The implementation should include equivalents of the following.

## User

```text
id
name
email
created_at
updated_at
```

## Project

```text
id
owner_user_id
name
description
created_at
updated_at
```

## ProjectMember / ProjectAssociation

```text
id
project_id
user_id
created_at
```

## Quiz

```text
id
project_id
creator_user_id
title
description
cover_image
status
scheduled_at
registration_limit
default_question_duration
allow_late_join
created_at
updated_at
```

## Question

```text
id
quiz_id
type
text
image
default_order
duration_override
created_at
updated_at
```

## QuestionOption

```text
id
question_id
text
is_correct
order
```

## QuizRegistration

```text
id
quiz_id
user_id
registered_at
status
```

## LiveQuizSession

```text
id
quiz_id
host_user_id
state
current_question_id
started_at
ended_at
```

## AskedQuestion

Represents questions actually used during a specific live session.

```text
id
live_session_id
question_id
asked_sequence
started_at
ended_at
```

This entity is important because final results depend on **questions actually asked**, not all questions created.

## ParticipantSession

```text
id
live_session_id
user_id
connection_status
joined_at
last_seen_at
```

## AnswerSubmission

```text
id
live_session_id
asked_question_id
user_id
answer_data
submitted_at
is_correct
points_awarded
status
```

Possible status:

```text
SUBMITTED
NOT_ATTEMPTED
```

## QuizResult

```text
id
live_session_id
user_id
total_score
rank
correct_count
incorrect_count
not_attempted_count
```

---

# 39. Real-Time Events

Suggested real-time events.

Host/server → participant:

```text
quiz_started
question_started
question_ended
question_result
leaderboard_shown
leaderboard_hidden
quiz_ended
session_state_sync
```

Participant → server:

```text
join_session
submit_answer
heartbeat
reconnect
```

Host → server:

```text
start_quiz
select_question
show_leaderboard
hide_leaderboard
set_late_join
end_quiz
```

Naming may differ, but behavior should remain equivalent.

---

# 40. Security / Integrity Requirements

MVP must ensure:

- participant cannot submit after timer expires,
- participant cannot change locked submission,
- participant cannot submit twice,
- scoring is server-side,
- correct answer must not be sent to participant before timer expiry,
- live answer distribution must not be sent to participants before timer expiry,
- only quiz creator can send host-control actions,
- participant cannot impersonate another participant,
- participant cannot modify scores client-side,
- session state is authoritative on server.

---

# 41. Non-Functional Requirements

## Real-time behavior

Question state and host controls should feel near-real-time.

## Reconnection

Temporary network interruptions should not permanently remove the participant.

## Responsive UI

Participant experience must work well on:

- mobile browsers,
- tablets,
- desktop browsers.

Host interface should prioritize desktop/tablet but remain usable responsively.

## Consistency

Server is the source of truth for:

- timer,
- answer lock,
- score,
- leaderboard,
- quiz state.

## Basic observability

Log important live-session events such as:

- quiz start,
- question start/end,
- answer submission failure,
- participant reconnect,
- host end quiz.

---

# 42. Explicitly Out of Scope for MVP

Do **not** build these unless the scope is intentionally changed later:

- Co-hosts
- Collaborative live quiz editing
- Spectator mode
- Password-protected quizzes
- Team quizzes
- Paid quizzes
- Ticketing
- Certificates
- AI quiz generation
- AI descriptive grading
- Manual descriptive grading
- Advanced analytics
- Custom scoring formulas in UI
- Negative marking
- Streak bonuses
- Chat
- Video questions
- Live streaming
- Custom branding
- Question bank
- Public quiz marketplace
- Full historical question review
- Host stopping a running question early
- Separate pause button
- Multiple simultaneous live quizzes for one host
- Participant-visible live answer percentages before timer expiry
- Complex anti-cheating
- Notifications via SMS/email/push
- Social login
- Mobile OTP authentication

---

# 43. MVP BUILD PLAN

> **Important for AI coding agents:** Build and validate one phase at a time.  
> Do not implement later phases until the current phase acceptance criteria pass.

---

# PHASE 0 — Foundation

## Goal

Create the project foundation and core application structure.

## Build

- Application repository
- Environment configuration
- Database connection
- Authentication framework
- Base UI shell
- Basic routing
- Error handling
- Logging
- Development seed strategy

## Acceptance Criteria

- Application boots locally.
- Database migrations run successfully.
- User can reach login/signup pages.
- Authenticated and unauthenticated routes can be distinguished.
- Project has documented local setup instructions.

## Do Not Build Yet

- Projects
- Quiz builder
- Real-time features
- Scoring
- Leaderboards

---

# PHASE 1 — Authentication and User Profile

## Goal

Users can create and access their account.

## Build

- Email signup
- Email login
- Logout
- User session
- Basic profile
- Real name field
- Protected routes

## Acceptance Criteria

- New user can register.
- Existing user can login.
- Session persists correctly.
- User can logout.
- Protected pages cannot be accessed when logged out.
- Real name is saved.

## Do Not Build Yet

- Mobile OTP
- Social login
- Anonymous users

---

# PHASE 2 — Projects and Dashboard Skeleton

## Goal

Create the product hierarchy before building quizzes.

## Build

- Create project
- Edit basic project details
- List owned projects
- Project detail page
- Host dashboard shell
- Participant dashboard shell
- Project association data model

## Acceptance Criteria

- Host can create multiple projects.
- Host can open a project.
- Project ownership is enforced.
- Dashboard separates host-related and participant-related information cleanly.

## Do Not Build Yet

- Live sessions
- Quiz participation
- Project notifications

---

# PHASE 3 — Quiz Builder

## Goal

Hosts can fully prepare a quiz before anything goes live.

## Build

- Create quiz inside project
- Quiz title
- Description
- Cover image
- Registration limit
- Default question timer
- Schedule date/time
- Quiz status
- Create/edit/delete questions
- Single-choice MCQ
- Multiple-answer MCQ
- Descriptive question
- Optional image attachment
- Per-question timer override
- Question ordering

## Acceptance Criteria

- Host can create a quiz.
- Quiz belongs to exactly one project.
- Host can add all three question types.
- MCQ correct answers are stored securely.
- Multiple-answer question can store multiple correct options.
- Descriptive questions require no correct answer.
- Timer override works.
- Draft quiz can be edited.

## Do Not Build Yet

- Live room
- Real-time scoring
- Leaderboard

---

# PHASE 4 — Publishing, Registration, Link and QR

## Goal

Participants can discover a published quiz and register.

## Build

- Publish quiz
- Scheduled quiz
- Unique quiz URL
- QR code
- Quiz public landing page
- Login/signup redirect back to quiz
- Register
- Unregister before start
- Registration limit
- Registration closed/full state
- Participant dashboard Upcoming section
- Project association when joining/registering

## Acceptance Criteria

- Published quiz has working unique URL.
- QR code resolves to the quiz.
- Logged-out user returns to quiz after authentication.
- User can register.
- User cannot register twice.
- Registration stops at capacity.
- Unregistration releases a slot before start.
- Registered quiz appears in participant dashboard.
- Participant becomes associated with quiz project.

## Do Not Build Yet

- Live question delivery
- Scoring
- Real-time leaderboard

---

# PHASE 5 — Lobby and Live Session Foundation

## Goal

Create the real-time room and authoritative live-session state.

## Build

- Lobby
- Host connected participant count
- Participant waiting screen
- Start Quiz
- LiveQuizSession
- ParticipantSession
- Server-authoritative room state
- One live quiz per host
- One active participant session per user/quiz
- Basic reconnection/state sync
- Allow New Participants toggle

## Acceptance Criteria

- Registered participant can enter lobby.
- Host can see connected participant count.
- Host can start quiz.
- All clients receive live state change.
- Reconnecting participant restores current room state.
- Host cannot run a second live quiz simultaneously.
- Non-host cannot perform host actions.

## Do Not Build Yet

- Actual question scoring
- Leaderboard
- Final results

---

# PHASE 6 — Live Question Delivery and Submission

## Goal

Make the core live question loop functional.

## Build

- Host question preview
- Host selects any unanswered question
- Question begins immediately
- Server-authoritative timer
- Participant question view
- Submit answer
- Submission lock
- Explicit submission only
- Question timeout
- NOT_ATTEMPTED handling
- AskedQuestion record
- Skipped questions remain available
- Completed questions cannot replay
- Late participant enters current question

## Acceptance Criteria

- Host can choose Q3 before Q2.
- Selected question immediately starts.
- All connected participants see the same active question.
- Timer is consistent.
- Submitted answer cannot be changed.
- Duplicate submission rejected.
- Submission after expiry rejected.
- Non-submission becomes NOT_ATTEMPTED.
- AskedQuestion stores only questions actually presented.
- Late joiner gets only remaining time.

---

# PHASE 7 — Scoring and Personal Rank

## Goal

Implement competitive scoring.

## Build

- Server-side correctness validation
- Continuous time-based scoring
- Zero for incorrect
- Zero for not attempted
- Multiple-answer all-or-nothing
- Descriptive questions zero-score
- Total score calculation
- Rank calculation
- Shared rank on exact tie
- Participant post-question personal result

## Acceptance Criteria

- Faster correct answer earns more than slower correct answer.
- Incorrect answer earns zero.
- Multiple-answer partial answer earns zero.
- Descriptive answer does not affect total score.
- Participant sees points earned.
- Participant sees current total score.
- Participant sees current rank in format like `#47 of 600`.
- Exact score tie produces shared rank.

---

# PHASE 8 — Live Answer Distribution and Result Screen

## Goal

Add the interactive live analytics that make the product engaging.

## Build

- Host live answer counts
- Host live answer percentages
- Participant distribution hidden while timer active
- Automatic correct-answer reveal after timeout
- Participant final answer distribution
- Correct/incorrect visual state
- Descriptive response stream/cards
- Post-question waiting state

## Acceptance Criteria

- Host sees distribution change as answers arrive.
- Participant cannot access distribution before expiry.
- Participant cannot access correct answer before expiry.
- At expiry, correct answer appears automatically.
- Final distribution appears to participants.
- Descriptive responses appear on host screen without emphasizing participant identity.

---

# PHASE 9 — Host Presentation Controls and Leaderboard

## Goal

Give the host full control over the live presentation.

## Build

- Keep result screen visible
- Show leaderboard privately
- Show leaderboard to participants
- Hide leaderboard
- Top 10 leaderboard
- Select Next Question
- No autoplay

## Acceptance Criteria

- Timer ending does not automatically advance.
- Host can remain on result screen indefinitely.
- Host can show Top 10.
- Host can choose whether participants see leaderboard.
- Participant always retains access to personal rank.
- Host can then choose any unanswered question.

---

# PHASE 10 — Ending Quiz and Final Results

## Goal

Complete the full end-to-end MVP loop.

## Build

- End Quiz
- End early
- Score based only on AskedQuestion records
- Final leaderboard
- Host-controlled final leaderboard reveal
- Persist QuizResult
- Participant History
- Host completed quiz results
- Correct count
- Incorrect count
- Not-attempted count

## Acceptance Criteria

- Host can end with unused questions.
- Unused questions do not affect scoring or stats.
- Final result is persisted.
- Participant can reopen completed quiz summary.
- Host can view final participant results.
- Final leaderboard is not forced automatically.

---

# PHASE 11 — Reliability, Edge Cases and MVP Hardening

## Goal

Make the MVP safe enough for real usage.

## Build / Validate

- Reconnection during active question
- Reconnection after submission
- Browser refresh recovery
- Host refresh recovery
- Duplicate device/session behavior
- Registration race conditions
- Capacity race conditions
- Timer validation server-side
- Authorization checks
- Correct-answer leakage prevention
- Live percentage leakage prevention
- Empty quiz edge case
- No participant edge case
- Host ends during result state
- Host disconnect handling
- Mobile responsiveness
- Error and loading states

## Acceptance Criteria

- Refresh does not corrupt live state.
- Participant submission remains after reconnect.
- Score cannot be manipulated from frontend.
- Capacity cannot exceed configured registration limit.
- Correct answer cannot be retrieved before expiry.
- Live participant distribution cannot be retrieved before expiry.
- Host-only controls are protected server-side.
- Mobile participant flow is usable.

---

# PHASE 12 — MVP QA and Release

## Goal

Validate the complete product as a real live quiz.

## Required End-to-End Test

```text
1. User signs up.
2. User creates project.
3. User creates quiz.
4. User adds MCQ, multi-answer and descriptive questions.
5. User publishes/schedules quiz.
6. Participant opens link.
7. Participant registers.
8. Participant waits in lobby.
9. Host starts quiz.
10. Host selects question.
11. Participant answers.
12. Host sees live distribution.
13. Timer ends.
14. Participant sees answer result and rank.
15. Host optionally shows leaderboard.
16. Host chooses a different unanswered question.
17. Participant disconnects and reconnects.
18. Host asks descriptive question.
19. Host ends quiz before using every created question.
20. Final results use only asked questions.
21. Participant sees history.
22. Host sees completed results.
```

MVP is release-ready only when this scenario passes consistently.

---

# 44. Recommended Development Order Summary

```text
Phase 0  Foundation
Phase 1  Authentication
Phase 2  Projects / Dashboard
Phase 3  Quiz Builder
Phase 4  Publishing / Registration
Phase 5  Lobby / Live Session Foundation
Phase 6  Live Questions / Submission
Phase 7  Scoring / Personal Rank
Phase 8  Live Distribution / Result Screen
Phase 9  Leaderboard / Host Controls
Phase 10 Final Results / History
Phase 11 Reliability / Edge Cases
Phase 12 QA / Release
```

---

# 45. AI Coding Agent Instructions

When using this PRD with Codex, Claude, or another coding agent:

## Rule 1 — Work one phase at a time

Do not ask the coding agent to "build the entire MVP."

Example:

```text
Implement Phase 3 only.
Do not start Phase 4.
After implementation, verify every Phase 3 acceptance criterion.
```

## Rule 2 — Preserve product rules

The agent must not silently change:

- scoring behavior,
- answer-lock rules,
- late-join behavior,
- host controls,
- quiz states,
- participant visibility rules.

If implementation requires a product decision not covered by this PRD, document the assumption before coding.

## Rule 3 — Server owns competitive state

Do not trust the browser for:

- timer expiry,
- correctness,
- points,
- rank,
- answer lock,
- registration capacity,
- host permissions.

## Rule 4 — Avoid future-scope features

Do not add "helpful" features from the Out of Scope section during MVP phases.

## Rule 5 — Validate before progressing

At the end of each phase:

1. run relevant tests,
2. verify acceptance criteria,
3. document known issues,
4. only then begin the next phase.

---

# 46. MVP Definition of Done

The MVP is complete when:

- users can authenticate,
- hosts can create projects,
- hosts can create quizzes,
- all MVP question types work,
- quizzes can be scheduled/published,
- participants can register through link/QR/dashboard,
- registration capacity works,
- lobby works,
- host starts live quiz,
- host controls question sequence,
- answers lock after submission,
- timer is server-authoritative,
- live host percentages work,
- participant percentages remain hidden until expiry,
- automatic answer reveal works,
- correctness + speed scoring works,
- personal rank works,
- Top 10 leaderboard works,
- host controls leaderboard visibility,
- late joining works,
- reconnection works,
- descriptive responses work,
- host can end early,
- only asked questions affect results,
- final results persist,
- participant history works,
- host completed results work,
- MVP end-to-end QA passes.

---

# 47. Future Product Backlog

After MVP is stable, future versions may explore:

- Co-hosting
- Collaborative live editing
- Team quizzes
- Spectator mode
- AI quiz generation
- AI-assisted grading
- Manual descriptive grading
- Advanced analytics
- Question bank
- Custom scoring
- Negative marking
- Streak bonuses
- Certificates
- Paid events
- Notifications
- Custom branding
- Historical question review
- Public discovery
- Anti-cheating tools
- Video/media questions
- Live streaming integrations

These should be treated as **post-MVP** and should not block MVP launch.

---

**End of PRD**
