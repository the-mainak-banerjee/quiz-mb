# QuizMB Security Design

Version 2 — October 7, 2026 (open decisions resolved)

This document records the agreed security rules for QuizMB, feature by feature: what each feature does, how it could be abused, how we protect it, and the exact limits. It is split into two phases:

- **Phase 1 — Before payments.** Everything we can build now, without a payment provider or plans. Plan-shaped limits (hosted sessions, participants, questions, projects, media storage) are enforced as **one fixed limit for every account**, kept in a single configuration so Phase 2 can replace it with a per-plan lookup without rewriting the features.
- **Phase 2 — After payments.** What changes once a payment provider and Free / Pro / Scale plans exist: plan-based limits, entitlement checks, payment events, upgrades and downgrades, and paid-only features.

Product behaviour stays defined by `docs/PRD.md`; this document adds the security and abuse-prevention rules on top of it.

## How to read this document

Each Phase 1 rule carries an implementation status, checked against the code on `develop` (October 7, 2026):

| Status          | Meaning                                                                                 |
| --------------- | --------------------------------------------------------------------------------------- |
| **Implemented** | Built as agreed and enforced on the server.                                             |
| **Partial**     | The mechanism exists but the rule differs (for example a different number), or part of it is missing. The note says what is missing. |
| **To build**    | Not implemented yet.                                                                    |

All design decisions are confirmed. Phase 2 rules have no status: none of them can be built before payments.

All limits are proposed starting values, not measured capacity. Review them after load testing and real usage.

## Principles that apply everywhere

1. **The server is the authority.** It decides identity, permissions, quiz lifecycle, timing, answer eligibility, correctness, scoring, ranking, capacity and quotas. Hiding a button is never a protection.
2. **Authentication and authorization on every request.** Authentication answers _who is making this request_; authorization answers _is that person allowed to do this_. Both are checked on every REST request and every socket command.
3. **Limits hold under concurrency.** Two simultaneous requests, a refresh, another browser or a direct API call must not get around a limit. Use atomic database operations, constraints or locks.
4. **Account-based limits, not IP-based identity.** A classroom or office shares one IP, so IP limits are only a coarse traffic safeguard, never proof that two accounts are different people. We prevent duplicates **per account**; one person with several verified accounts remains a known limitation.
5. **Fail closed on competitive checks.** If authorization, quota or the answer lock cannot be checked, reject the operation temporarily. Never accept an unchecked answer or invent a score. (Request rate limits are the deliberate exception: they fail open so a Redis outage does not take the product down.)
6. **Never log secrets.** No passwords, codes, tokens, cookies or unnecessary answer content in logs.

---

# Phase 1 — Before payments

## 1.1 Account creation and email verification

**What it does.** A user signs up with name, email and password, then proves they control the inbox with a six-digit code. Authenticated features require a verified email.

| Abuse                                                         | Protection                                                                                         | Status                                                                                       |
| ------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Duplicate accounts with the same email                        | Normalize email (trim, lowercase) and enforce a unique database constraint                         | **Implemented**                                                                              |
| Call project/quiz APIs or sockets without verifying           | No session exists until the code is accepted; every authenticated request re-checks verification    | **Implemented**                                                                              |
| Spam an inbox or burn the email budget by requesting codes | Resend cooldown, per-email send limits, platform-wide daily email budget (see below) | **Implemented** |
| Guess a code                                                  | Five wrong attempts per code, then the code is invalid                                             | **Implemented**                                                                              |
| Request a new code to reset the guess count                   | Rolling failure limit per email and purpose that survives resends                                  | **Implemented**                                                                              |
| Reuse a code, or submit it from two tabs at once              | Single use, consumed atomically together with marking the account verified                         | **Implemented**                                                                              |
| Use a verification code to reset a password (or the reverse)  | Codes are bound to account and purpose                                                             | **Implemented**                                                                              |
| Learn whether an email is registered through signup           | Signup gives the same response whether or not the email exists, and emails the owner instead        | **Implemented** — verified owner gets a notice; an unverified account gets a fresh code; the existing account is never changed |
| Mass signups with many email addresses                        | Signup throttling, verification, small per-account limits; a bot challenge only if abuse appears   | **Implemented** — per-IP signup limit (20 per hour) and verification; the bot challenge is deferred until abuse appears, as agreed |
| Thousands of abandoned unverified accounts | Delete accounts that were never verified 7 days after signup, with their verification codes | **Implemented** — hourly cleanup in the API |

**Limits**

| Control                                 | Agreed rule                                                        | Current                                          |
| --------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| Code format                             | Cryptographically random, six digits                               | Implemented                                      |
| Code validity                           | 10 minutes                                                         | Implemented                                      |
| Resend cooldown                         | 60 seconds                                                         | Implemented                                      |
| Verification emails per email address   | 5 per hour and 10 per rolling 24 hours, including the first send   | Implemented (also for reset codes)               |
| Wrong attempts per code                 | 5, then the code is invalidated                                    | Implemented                                      |
| Failures across resends                 | 10 per email and purpose in a rolling 30 minutes, then reject checks until below the limit | Implemented                            |
| Valid codes                             | Only the latest code is valid                                      | Implemented                                      |
| Code storage                            | Keyed hash with a server secret; never logged                      | Implemented (HMAC)                               |
| Password storage                        | Slow password hash                                                 | Implemented (Argon2id)                           |
| Unverified account retention | 7 days after signup, delete accounts that have **never** been verified, and their verification codes. Never applies to verified accounts, however inactive | Implemented |
| Platform email budget | Warning at 80% of the provider's daily allowance; hard protection at 90% (see below) | Implemented (`EMAIL_DAILY_LIMIT`, default 100; alerts are log lines) |

**Platform email budget.** QuizMB counts every email it sends per day against an internal threshold below the email provider's daily quota:

| Daily usage      | Behaviour                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Below 80%        | Normal                                                                                                                    |
| 80% (warning)    | Log and alert the team                                                                                                    |
| 90% (hard limit) | Refuse non-essential sends (repeat resends); keep the most important auth emails (first verification code, password reset, security notices) where possible; log and alert |

**Acceptance checks:** simultaneous code submissions verify once; a resend never restores failed attempts; an unverified account cannot reach any project, quiz, registration or socket endpoint.

## 1.2 Login, sessions and logout

**What it does.** A user signs in with email and password. A verified account gets a session (short-lived access token plus rotating refresh token); an unverified account is sent into the verification flow only.

| Abuse                                              | Protection                                                                                         | Status                                                                                       |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Guess one account's password                       | 5 wrong passwords in 15 minutes pause password login for that account for 15 minutes               | **Implemented** — per email address (also for unknown ones, so the pause reveals nothing); Redis-backed and fails open like the rate limits |
| Try stolen passwords across many accounts          | Per-IP throttling; bot challenge if automated abuse appears                                        | **Implemented** — 100 per IP per minute; the bot challenge is deferred until automated abuse appears, as agreed |
| Discover registered emails from error messages     | Same "Email or password is incorrect" for unknown email and wrong password, with equal timing       | **Implemented** (dummy hash keeps timing equal)                                              |
| Lock a real user out on purpose                    | Short pause that requests during the pause do not extend; password reset and existing sessions keep working | **Implemented** — fixed 15-minute pause that refused requests do not extend; existing sessions keep working; a completed password reset ends the pause |
| Skip verification by calling login directly        | Correct credentials for an unverified account only start verification                              | **Implemented**                                                                              |
| Steal and replay a refresh token                   | Rotate on every refresh; reuse of an old token revokes the whole session family                    | **Implemented**                                                                              |
| Keep using a session after logout                  | Logout revokes the session family; access is re-checked against the session on every request       | **Implemented** — REST and sockets |
| Open socket stays connected after logout           | Revocation also disconnects that session's sockets and refuses new socket tickets                  | **Implemented** — socket tickets carry the sign-in family; logout or refresh-token replay disconnects its sockets (the live page is told why) and new tickets are refused |
| Cross-site request forgery with cookies            | Origin check on every state-changing request; explicit trusted origins; HTTPS                      | **Implemented**                                                                              |

**Limits**

| Control                         | Agreed rule                                                                     | Current                   |
| ------------------------------- | ------------------------------------------------------------------------------- | ------------------------- |
| Wrong passwords per account     | 5 in 15 minutes → 15-minute pause of password login                              | Implemented |
| During the pause                | Rejected requests do not extend the pause                                        | Implemented |
| Requests per IP                 | 100 per minute                                                                   | Implemented |
| Successful login                | Resets the account's failure count; broader abuse counters remain               | Implemented |
| Existing sessions               | Stay active when someone triggers the failure limit                              | Implemented               |

## 1.3 Forgot password

**What it does.** A user proves access to their email with a reset code, then sets a new password. Requesting a reset changes nothing and signs nobody out; changes happen only after the new password is set.

| Abuse                                                   | Protection                                                                          | Status                                                                 |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Flood someone with reset emails                         | Resend cooldown and per-email send limits                                           | **Implemented** — 60 s cooldown, 5 per hour and 10 per rolling 24 hours per address (shared with 1.1) |
| Guess the reset code                                    | 5 tries per code plus a rolling failure limit across resends                        | **Implemented** — 5 tries per code and 10 failures per email in a rolling 30 minutes across resends (shared with 1.1) |
| Discover whether an email has an account                | Always answer "If an account exists for this email, we've sent a reset code"         | **Implemented**                                                        |
| Use a verification code here                            | Separate `EMAIL_VERIFICATION` and `PASSWORD_RESET` purposes                         | **Implemented**                                                        |
| Skip the code and call the set-password API              | Requires a server-issued, short-lived, single-use reset authorization               | **Implemented**                                                        |
| Reuse a code or reset authorization                     | Both single use, consumed atomically                                                | **Implemented**                                                        |
| Keep using a stolen session after the owner resets | A successful reset revokes every session and refresh-token family and disconnects all of that user's sockets | **Partial** — every session is revoked; open sockets stay connected |

**Limits**

| Control                        | Agreed rule                                                              | Current                       |
| ------------------------------ | ------------------------------------------------------------------------ | ----------------------------- |
| Reset code                     | Six digits, valid 10 minutes                                             | Implemented                   |
| Cooldown                       | 60 seconds                                                               | Implemented                   |
| Reset emails per address       | 5 per hour and 10 per rolling 24 hours                                   | Implemented |
| Wrong attempts                 | 5 per code, then invalid                                                 | Implemented                   |
| Failures across resends        | 10 per email and purpose in a rolling 30 minutes                         | Implemented |
| Reset authorization            | Valid 5 minutes, single use, only allows setting a new password          | Partial (valid 15 minutes)    |
| After a successful reset | Revoke all sessions, invalidate refresh-token families, disconnect all sockets, send a "Your QuizMB password was changed" security email, require login again | Partial (sessions and refresh tokens revoked, login required; sockets and security email to build) |

Revoking sockets can interrupt a live quiz for that account. That is accepted: it stops someone already inside a compromised account from keeping access.

## 1.4 Projects

**What it does.** Hosts organize quizzes in projects.

| Abuse                                         | Protection                                                                     | Status                                    |
| --------------------------------------------- | ------------------------------------------------------------------------------ | ----------------------------------------- |
| Read or change another host's project         | Ownership check on every project request                                       | **Implemented**                           |
| Create unlimited projects                     | Fixed limit of **3 projects per account**, checked atomically on create        | **To build**                              |
| Create projects by script | 5 project creations per minute per account | **To build** |
| Huge project lists                            | Cursor pagination with a server-enforced page size                             | **Implemented** (25 per page)             |
| Oversized names or descriptions               | Length limits (60 / 240 characters)                                            | **Implemented**                           |
| Deleting a project with a live quiz           | Only draft content is deleted; live and completed quizzes are protected        | **Implemented**                           |

## 1.5 Quizzes, questions and media uploads

**What it does.** Hosts create unlimited draft quizzes with questions and optional images.

**Quizzes and questions**

| Abuse                                                 | Protection                                                                                                  | Status                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Edit another host's quiz                              | Ownership check on every request                                                                            | **Implemented**                                                        |
| Create drafts rapidly by script                       | 5 quiz creations per minute per account                                                                     | **To build**                                                           |
| Create drafts steadily all day                        | 100 successful quiz creations per rolling 24 hours per account, across projects                             | **To build**                                                           |
| Delete and recreate to get around limits              | Deleting never restores creation counts                                                                      | **To build** (with the counters above)                                 |
| Duplicate/import later bypasses creation limits        | Every quiz produced counts toward the same allowance                                                        | **To build** (when duplicate/import exists)                            |
| Too many questions in one quiz                        | Fixed limit of **25 questions per quiz**, checked atomically when adding (also for future duplicate/import) | **Partial** — enforced, but the limit is 200                           |
| Oversized text, options or requests                   | Length and count limits; 128 KB JSON request limit                                                          | **Implemented** (prompt 10,000, option 1,000, 20 options)              |
| Change answers or timing after the quiz is announced  | Questions lock when the lobby opens; quiz details lock when it goes live                                    | **Implemented**                                                        |
| Huge dashboards                                       | Paginated lists with a server maximum                                                                       | **Implemented**                                                        |

**Media uploads**

| Abuse                                                  | Protection                                                                                              | Status                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Store huge files | Every image is optimized before it is stored (see **Image optimization**); the stored file is at most 250 KB | **Partial** — files up to 10 MB are stored as uploaded |
| Store full-size originals | Only the optimized image is stored; the original is never saved to storage or the database | **To build** |
| Upload something that is not an image                  | JPEG, PNG and WebP only; file signature checked on the server; private bucket enforcing type and size  | **Implemented**                                                                  |
| Unlimited drafts become unlimited image storage        | **5 MB of stored media per account**, across projects and quizzes; space reserved atomically before an upload is authorized | **To build**                                      |
| Upload by script                                       | 5 upload requests per minute and 50 successful uploads per rolling 24 hours per account                | **Partial** — 30 requests per 10 minutes; no daily cap                           |
| Bypass quotas by writing to storage directly           | Uploads only through server-issued signed upload tickets; storage keys stay on the server               | **Implemented**                                                                  |
| Delete an image a live quiz needs                      | Media changes follow the quiz edit lock                                                                  | **Implemented**                                                                  |
| Abandoned or orphaned uploads fill storage             | Expire unfinished uploads and remove orphaned files automatically; release quota only after the file is deleted | **To build**                                                               |
| Many accounts together exhaust the 1 GB storage        | Platform storage warning at 600 MB; pause new uploads at 800 MB, counting pending reservations          | **To build**                                                                     |
| Bandwidth (egress) runs out                            | Monitor cached and uncached egress separately; review before the monthly allowance runs out            | **To build** (monitoring)                                                        |

**Image optimization.** A user may pick a large photo (for example 10 MB from a phone camera). QuizMB never stores that original:

1. The browser decodes the image and resizes it to at most **1,600 px on the longest side**, keeping the aspect ratio (never upscaling).
2. It re-encodes the image (WebP, or JPEG as fallback) and lowers quality step by step until the file is **250 KB or less**. If it cannot reach 250 KB, the upload is refused with a clear message.
3. Re-encoding drops all metadata (EXIF, including GPS location and camera details), so no private data in the photo is stored or shown to participants.
4. Only the optimized file is uploaded. The server issues the signed upload ticket only for a declared size of 250 KB or less, the storage bucket rejects anything larger, and the server verifies the stored file's real size and signature before the image can be attached.
5. Storage quota (5 MB per account) counts the optimized size.

Selection limits before optimization: JPEG, PNG or WebP, at most 20 MB and 40 megapixels, so a decompression bomb cannot freeze the browser. Animated images are stored as a single still frame.

Optimizing in the browser keeps the original off our servers and costs no server CPU (Supabase image transformations need a paid plan). The server's size, type and signature checks keep this safe against a modified client. Server-side re-encoding (an upload proxy with an image library) is a possible later hardening step and would need a new dependency approved.

When a user's storage is full: text-only editing continues, existing images stay, new uploads are refused with a clear usage message, and the user can delete eligible images. A replacement temporarily needs room for both files.

User-facing summary: _Unlimited draft quizzes · 25 questions per quiz · 5 MB media storage · Images are optimized automatically to 250 KB or less. Creation and upload rate limits apply._

## 1.6 Host controls and the live-session lifecycle

**What it does.** The host opens a lobby, starts the quiz, asks questions, shows the leaderboard and ends the quiz.

| Abuse or failure                                   | Protection                                                                                                  | Status                                                       |
| -------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Participant sends a host command                   | Role derived on the server; host ownership checked on every REST request and socket command                 | **Implemented**                                              |
| Host runs two quizzes at once                      | One unfinished session per host, including an open lobby (service, transaction and partial unique index)    | **Implemented**                                              |
| Duplicate or retried Start                         | Start succeeds once; it consumes the hosted-session allowance exactly once                                  | **Partial** — start is exactly once; the allowance does not exist yet (see 1.6.1) |
| Start a question while one is active               | Server rejects invalid state transitions                                                                    | **Implemented**                                              |
| Change answers or timing during play               | Content frozen from lobby/live; server-owned question timer                                                 | **Implemented**                                              |
| Ask the same question twice                        | Rejected within the session (unique constraint)                                                             | **Implemented**                                              |
| Flood host commands                                | Per-socket command budget                                                                                   | **Implemented** (values in 1.10)                             |
| Host disconnects                                   | The question timer keeps running, accepted answers stay, nothing advances automatically; the host reconnects to the server state | **Implemented**                      |
| Abandoned lobby keeps resources | Lobby expires 30 minutes after opening if the quiz has not started (see below) | **To build** |
| Host never comes back | 15-minute grace with no valid host connection, then the quiz is finalized (see below) | **To build** (participants are only told after 5 seconds) |
| Session runs forever | 4-hour maximum with a warning at 3 h 30 min (see below) | **To build** |

An expired lobby does not consume hosted-session allowance; a started session does, even if it times out.

**Lobby expiry — 30 minutes.** If the lobby is open and the quiz has not started 30 minutes after opening:

- The lobby expires and the quiz returns to `PUBLISHED` (registrations kept).
- The host is taken back to quiz management.
- Participants see "Lobby expired".
- No hosted-session allowance is consumed.

**Host disconnect grace — 15 minutes.** The timer starts when the host has **no valid live connection** (a connected but idle host never times out):

- Host reconnects within 15 minutes → the session continues where it was.
- Host does not reconnect → the quiz is finalized with the valid results collected so far (an active question closes at its deadline or at that moment) and becomes `COMPLETED`.

**Maximum live session — 4 hours from start.**

| Time from start | What happens                                                                                       |
| --------------- | -------------------------------------------------------------------------------------------------- |
| 0:00 – 3:30     | Normal session                                                                                     |
| 3:30            | Final warning to host and participants; a 30-minute grace period starts                            |
| 4:00            | Hard stop: the current quiz is finalized with its results (an active question closes) and becomes `COMPLETED` |

All three run on the server and survive an API restart (deadlines are stored, timers are re-armed at boot, and every interaction checks them), like question timers today.

### 1.6.1 Hosted-session allowance

Phase 1 applies one fixed allowance to every account: **3 hosted quiz sessions per calendar month**, shared across all projects.

| Situation                                   | Rule                                              | Status       |
| ------------------------------------------- | ------------------------------------------------- | ------------ |
| Create a draft, publish, or open the lobby  | Does not consume a session                        | **To build** |
| The server successfully starts the quiz     | Consumes one session, atomically with the start   | **To build** |
| Double-click Start or retry the request     | Counts once                                       | **To build** |
| Refresh or reconnect                        | No extra charge                                   | **To build** |
| End early or delete the quiz                | Does not restore the allowance                    | **To build** |
| Monthly reset                               | Calendar month (UTC), with the reset date shown   | **To build** |
| Unused allowance                            | Does not carry forward                            | **To build** |
| No allowance left                           | Start is refused with a clear message; the lobby stays open until it expires | **To build** |

## 1.7 Participant registration, joining and reconnecting

| Abuse                                                 | Protection                                                                                         | Status                                                               |
| ----------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Register twice with one account                       | Unique `(quizId, userId)` in the database                                                          | **Implemented**                                                      |
| Simultaneous registrations exceed capacity            | Capacity enforced atomically in one database function                                              | **Implemented**                                                      |
| Capacity beyond what the platform supports            | Host capacity capped at a fixed **30 participants per session**                                    | **Partial** — capped at 10,000                                        |
| Host registers for their own quiz                     | Refused                                                                                            | **Implemented**                                                      |
| Join with a guessed session id                        | Verified account, valid registration and a short-lived, session-bound socket ticket                | **Implemented**                                                      |
| Ask for host-room membership                          | Server chooses rooms from the derived role                                                         | **Implemented**                                                      |
| Take part from several tabs or devices                | Newest valid connection replaces the old one; the old one cannot submit                            | **Implemented**                                                      |
| Reconnect for extra time or another attempt           | Saved submission and original deadline are restored                                                | **Implemented**                                                      |
| Register after the quiz starts                        | Registration closes at start. Late join lets an already-registered participant enter later; it never reopens registration | **Implemented**             |

We prevent duplicate participation per account, not per person.

## 1.8 Answer submission and scoring

| Cheating attempt                                         | Protection                                                                 | Status                                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Send own score, rank, correctness or response time       | Server computes every competitive value                                    | **Implemented**                                                                         |
| Change the device clock or send an early timestamp       | Server receipt time and server deadline only                               | **Implemented**                                                                         |
| Submit after the deadline                                | Rejected even if the browser still shows time                              | **Implemented**                                                                         |
| Submit twice or change an accepted answer                | One accepted answer per participant per asked question, enforced atomically | **Implemented**                                                                         |
| Retry because the acknowledgement was lost               | Return the saved answer without scoring again                              | **Partial** — the retry is refused with `ALREADY_SUBMITTED` and the client reloads the saved answer |
| Submit options from another question                     | Options validated against the asked question                               | **Implemented**                                                                         |
| Submit for another session's question                    | Refused before revealing anything about it                                 | **Implemented**                                                                         |
| Submit from the replaced device                          | Only the current connection may submit                                     | **Implemented**                                                                         |
| Read the correct answer from network traffic             | Answer keys and live distribution never sent to participants before close  | **Implemented**                                                                         |
| HTML or script in a descriptive answer                   | 2,000-character limit; always rendered as text                             | **Implemented**                                                                         |

## 1.9 Results and who can see what

| Rule                                                                                       | Status                                              |
| ------------------------------------------------------------------------------------------ | --------------------------------------------------- |
| Registration lists, detailed distributions and full results are host only                  | **Implemented**                                     |
| Participants see only their own results and leaderboards the host chose to show            | **Implemented**                                     |
| Leaderboard visibility is host-controlled, including the final leaderboard                 | **Implemented**                                     |
| Reconnect snapshots follow the same visibility rules                                       | **Implemented**                                     |
| Public quiz pages expose only approved public fields (never answer keys)                   | **Implemented**                                     |
| Shared leaderboards list at most 10 participants who scored                                | **Implemented**                                     |
| Long result lists are paginated                                                            | **Implemented** (100 per page)                      |

## 1.10 Live traffic limits

Starting values, to validate under load. Participant limits are per account and session, not per IP, because a classroom shares one IP.

| Operation                                   | Agreed rule                       | Current                                                       | Status        |
| ------------------------------------------- | --------------------------------- | ------------------------------------------------------------- | ------------- |
| Register / unregister                       | 10 per minute per account         | 20 per minute (register only)                                  | **Partial**   |
| Socket tickets                              | 20 per minute per account         | 30 per minute                                                  | **Partial**   |
| Participant sync                            | 30 per minute per account/session | 20 per 10 s per socket                                        | **Partial**   |
| Answer submissions, including retries       | 10 per minute per account/session | 10 per 10 s per socket                                        | **Partial**   |
| Host commands                               | 60 per minute per host/session    | 30 per 10 s per socket                                        | **Partial**   |
| One incoming socket message                 | 16 KB maximum                     | Socket.IO default (1 MB)                                       | **To build**  |
| Descriptive answer                          | 2,000 characters                  | 2,000                                                         | **Implemented** |
| Counters survive reconnects                 | Yes                               | Counted per socket; reconnects are bounded by the ticket limit | **Partial**   |
| Repeated flooding | Disconnect a connection that repeatedly exceeds its limits | Commands are refused, the connection stays | **To build** |
| Infrastructure heartbeats                   | Never count against command limits | Not counted                                                  | **Implemented** |


## 1.11 Platform-wide safeguards

| Area                 | Rule                                                                                                   | Status                                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------- |
| Transport            | HTTPS and WSS only in production; explicit trusted origins; CORS is never treated as authorization     | **Implemented**                                                        |
| CSRF                 | Origin check on every cookie-authenticated state change                                                 | **Implemented**                                                        |
| Secrets              | Privileged keys only on the server; configuration from validated environment                           | **Implemented**                                                        |
| Client IP            | Taken from a trusted proxy hop count only                                                              | **Implemented**                                                        |
| Database             | Row-level security on every table; the API is the only data path                                       | **Implemented**                                                        |
| Failure handling     | Competitive checks fail closed; rate limits fail open; pool saturation returns a retryable `503`        | **Implemented**                                                        |
| Logging              | Joins, refusals and lifecycle logged with ids and codes; passwords, codes and tokens redacted           | **Implemented**                                                        |
| Monitoring           | Alerts for rejected host actions, unusual traffic, quota failures, storage and egress usage             | **To build**                                                           |
| Protective switch    | One setting to pause new signups, quiz creation or uploads before capacity is exhausted                | **To build**                                                           |
| Fair-use policy      | Published policy for unlimited drafts and the limits above                                             | **To build**                                                           |
| Automated tests      | Simultaneous starts, duplicate submissions, capacity races, expired codes, revoked sessions, participant access to host data | **Partial** — all exist except revoked-session socket tests and quota tests |

---

# Phase 2 — After payments

Phase 2 starts once a payment provider, plans and subscriptions exist. The Phase 1 fixed limits become the **Free** plan values, and every limit is read from the account's current entitlement.

## 2.1 Plans and limits

| Limit                                    | Free        | Pro         | Scale       |
| ---------------------------------------- | ----------- | ----------- | ----------- |
| Projects                                 | 3           | Unlimited\* | Unlimited\* |
| Draft quizzes                            | Unlimited\* | Unlimited\* | Unlimited\* |
| Questions per quiz                       | 25          | 100         | 250         |
| Hosted sessions per month                | 3           | 50          | Unlimited\* |
| Participants per session                 | 30          | 200         | 500         |
| Simultaneously active quizzes per host   | 1           | 1           | 1           |
| Media storage | 5 MB (≈ 20 maximum-size images) | 250 MB (≈ 1,000 maximum-size images) | 1 GB (≈ 4,000 maximum-size images) |

`*` Subject to disclosed storage and anti-abuse limits (creation and upload rates still apply). Fair-use and abuse protections apply to every plan, including storage. Pro and Scale storage exceeds the Supabase free tier, so the storage plan must be upgraded before paid plans are sold (see 2.6).

## 2.2 Entitlements

- The server decides the plan from its own subscription records, never from the browser, a URL or a client-side flag.
- One server function returns an account's limits; every quota check calls it (projects, questions, hosted sessions, participants, storage).
- A limit is checked at the moment of the action, atomically with it (for example the hosted-session count with the start).
- If the subscription state cannot be read, fall back to Free limits rather than granting paid ones.

## 2.3 Payment provider integration

| Abuse                                          | Protection                                                                                                   |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Fake "payment succeeded" request               | Plans change only from verified provider webhooks (signature checked) or a server-side lookup with the provider |
| Replayed or duplicated webhooks                | Store processed event ids; each event applies once                                                           |
| Events arriving out of order                   | Apply by the provider's event time or subscription version, never by arrival order                          |
| Changing the price or plan in the checkout request | Checkout sessions are created on the server with server-side price ids                                    |
| Card data exposure                             | Card data never touches QuizMB servers; use the provider's hosted checkout                                   |
| Provider keys leaked                           | Secret and webhook keys only on the server, separate per environment                                         |

## 2.4 Upgrades, downgrades and renewals

| Situation                                  | Rule                                                                                                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| Upgrade                                    | New limits apply as soon as the verified payment event arrives                                                 |
| Downgrade or cancellation                  | Takes effect at the end of the paid period; existing content is kept read-only beyond Free limits, never deleted |
| Over a limit after downgrading             | Block new actions beyond the limit (new projects, questions, uploads, starts) until usage is back within it    |
| Session already started                    | A live session keeps the participant limit it started with                                                     |
| Hosted-session allowance                   | Monthly reset follows the billing period for paid plans; upgrading mid-month grants the new plan's remaining allowance |
| Failed renewal                             | Grace period, then Free limits                                                                                 |
| Refund or chargeback                       | Return to Free limits; repeated chargebacks can suspend paid features                                          |

## 2.5 Paid-only features

- **CSV export:** checks ownership and the paid entitlement; protects cells against spreadsheet formula injection (prefix values starting with `=`, `+`, `-` or `@`).
- Every future paid feature checks the entitlement on the server for each request.

## 2.6 Capacity for paid plans

- Re-budget storage, egress, database connections and Redis commands for 200- and 500-participant sessions before selling them.
- Upgrade the storage plan before selling Pro or Scale: a single Scale account can use 1 GB, the whole Supabase free tier. Raise the Phase 1 platform thresholds (warning 600 MB, upload pause 800 MB) in line with the new storage capacity.
- Load-test the largest plan's participant limit before launch.
- Keep the platform-wide protective switch from Phase 1; paid accounts get priority when capacity is tight.

## 2.7 Billing abuse and monitoring

- Alert on webhook signature failures, repeated failed payments and unusual plan changes.
- Audit log of plan changes (who, when, which event), without card data.
- Rate-limit checkout session creation per account.

---

# Decision log

| Date            | Decision                                                                                                                                  |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| October 7, 2026 | Lobby expiry 30 min; host disconnect grace 15 min; 4-hour maximum with warning at 3 h 30 min (1.6)                                        |
| October 7, 2026 | Live traffic limits and the 16 KB message limit as listed; disconnect connections that repeatedly flood (1.10)                            |
| October 7, 2026 | Password reset revokes sessions, refresh-token families and sockets, sends a security email and requires login (1.3)                      |
| October 7, 2026 | Delete never-verified accounts after 7 days; email budget warning at 80%, hard protection at 90% (1.1)                                    |
| October 7, 2026 | 5 project creations per minute per account (1.4)                                                                                          |
| October 7, 2026 | Media storage: Free 5 MB, Pro 250 MB, Scale 1 GB (2.1)                                                                                    |
| October 7, 2026 | Every image is optimized before storage (1,600 px, 250 KB, metadata removed); originals are never stored (1.5)                            |
