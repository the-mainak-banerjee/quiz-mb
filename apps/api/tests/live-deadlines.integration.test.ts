import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCOUNT_LIMITS,
  ERROR_CODE,
  LIVE_EVENTS,
  LIVE_SESSION_LIMITS,
  LIVE_SESSION_STATE,
  QUIZ_STATUS,
  type HostLiveSnapshotDto,
  type LiveRemovedDto,
} from '@quizmb/contracts';
import { liveSkip, startLiveHarness } from './live-harness.js';

const MINUTE_MS = 60_000;

// Security design 1.6: the hosted-session allowance, lobby expiry, the host
// disconnect grace, the maximum session length and their recovery at boot.
test(
  'starts consume the monthly allowance once and never come back',
  { skip: liveSkip },
  async (t) => {
    const h = await startLiveHarness(t, ['host', 'player'] as const);
    const hostId = h.userIds.host;
    const { liveSessionId } = await h.openQuiz('Allowance', ['player']);
    // Starts already used this month.
    await h.db.usageEvent.createMany({
      data: Array.from(
        { length: ACCOUNT_LIMITS.hostedSessionsPerMonth },
        () => ({
          userId: hostId,
          kind: 'SESSION_STARTED' as const,
        }),
      ),
    });
    const host = await h.joinAs(liveSessionId, 'host');
    const lobby = host.snapshot as HostLiveSnapshotDto;
    assert.deepEqual(
      [lobby.hostingAllowance?.used, lobby.hostingAllowance?.limit],
      [
        ACCOUNT_LIMITS.hostedSessionsPerMonth,
        ACCOUNT_LIMITS.hostedSessionsPerMonth,
      ],
    );
    assert.ok(lobby.lobbyExpiresAt, 'the lobby shows when it expires');
    assert.equal(
      h.errorCode(await host.emit(LIVE_EVENTS.quizStart)),
      ERROR_CODE.LIMIT_REACHED,
    );
    assert.equal(
      (
        await h.db.liveQuizSession.findUniqueOrThrow({
          where: { id: liveSessionId },
        })
      ).state,
      LIVE_SESSION_STATE.LOBBY,
      'the lobby stays open',
    );

    // With allowance left, a double Start counts once.
    await h.db.usageEvent.deleteMany({ where: { userId: hostId } });
    const both = await Promise.all([
      host.emit(LIVE_EVENTS.quizStart),
      host.emit(LIVE_EVENTS.quizStart),
    ]);
    assert.equal(both.filter((ack) => ack.ok).length, 1);
    assert.equal(
      await h.db.usageEvent.count({
        where: { userId: hostId, kind: 'SESSION_STARTED' },
      }),
      1,
    );
    // Ending early does not give the start back.
    h.ok(await host.emit(LIVE_EVENTS.quizEnd));
    assert.equal(
      await h.db.usageEvent.count({
        where: { userId: hostId, kind: 'SESSION_STARTED' },
      }),
      1,
    );
  },
);

test(
  'an unstarted lobby expires after 30 minutes',
  { skip: liveSkip },
  async (t) => {
    const h = await startLiveHarness(t, ['host', 'player'] as const);
    const { quiz, liveSessionId } = await h.openQuiz('Lobby expiry', [
      'player',
    ]);
    const player = await h.joinAs(liveSessionId, 'player');
    const removed = h.nextEvent<LiveRemovedDto>(
      player.socket,
      LIVE_EVENTS.removed,
    );
    await h.db.liveQuizSession.update({
      where: { id: liveSessionId },
      data: {
        createdAt: new Date(
          Date.now() - (LIVE_SESSION_LIMITS.lobbyMinutes + 1) * MINUTE_MS,
        ),
      },
    });
    // As after a restart: the overdue deadline runs at once.
    await h.live.recoverDeadlines();
    assert.equal((await removed).code, ERROR_CODE.LOBBY_EXPIRED);
    assert.equal(
      await h.db.liveQuizSession.findUnique({ where: { id: liveSessionId } }),
      null,
    );
    const stored = await h.db.quiz.findUniqueOrThrow({
      where: { id: quiz.id },
    });
    assert.equal(stored.status, QUIZ_STATUS.PUBLISHED, 'published again');
    assert.equal(
      await h.db.quizRegistration.count({ where: { quizId: quiz.id } }),
      1,
      'registrations kept',
    );
    assert.equal(
      await h.db.usageEvent.count({
        where: { userId: h.userIds.host, kind: 'SESSION_STARTED' },
      }),
      0,
      'an expired lobby consumes nothing',
    );
  },
);

test(
  'a started quiz ends after 15 minutes without its host',
  { skip: liveSkip },
  async (t) => {
    const h = await startLiveHarness(t, ['host', 'player'] as const);
    const { liveSessionId } = await h.openQuiz('Host grace', ['player']);
    const host = await h.joinAs(liveSessionId, 'host');
    h.ok(await host.emit(LIVE_EVENTS.quizStart));
    const player = await h.joinAs(liveSessionId, 'player');
    const ended = h.nextEvent(player.socket, LIVE_EVENTS.quizEnded);
    await h.db.liveQuizSession.update({
      where: { id: liveSessionId },
      data: {
        hostDisconnectedAt: new Date(
          Date.now() - (LIVE_SESSION_LIMITS.hostGraceMinutes + 1) * MINUTE_MS,
        ),
      },
    });
    // Any interaction checks the deadline.
    await player.emit(LIVE_EVENTS.sync);
    await ended;
    assert.equal(
      (
        await h.db.liveQuizSession.findUniqueOrThrow({
          where: { id: liveSessionId },
        })
      ).state,
      LIVE_SESSION_STATE.COMPLETED,
    );
  },
);

test(
  'a live quiz ends at its 4-hour maximum and shows when it will end',
  { skip: liveSkip },
  async (t) => {
    const h = await startLiveHarness(t, ['host', 'player'] as const);
    const { liveSessionId } = await h.openQuiz('Maximum length', ['player']);
    const host = await h.joinAs(liveSessionId, 'host');
    const started = h.ok(
      await host.emit<HostLiveSnapshotDto>(LIVE_EVENTS.quizStart),
    );
    assert.ok(started.sessionEndsAt, 'the hard stop is in the snapshot');
    assert.equal(
      Date.parse(started.sessionEndsAt!) - Date.parse(started.startedAt!),
      LIVE_SESSION_LIMITS.maxMinutes * MINUTE_MS,
    );
    const player = await h.joinAs(liveSessionId, 'player');
    const ended = h.nextEvent(player.socket, LIVE_EVENTS.quizEnded);
    await h.db.liveQuizSession.update({
      where: { id: liveSessionId },
      data: {
        startedAt: new Date(
          Date.now() - (LIVE_SESSION_LIMITS.maxMinutes + 1) * MINUTE_MS,
        ),
      },
    });
    await player.emit(LIVE_EVENTS.sync);
    await ended;
    assert.equal(
      (
        await h.db.liveQuizSession.findUniqueOrThrow({
          where: { id: liveSessionId },
        })
      ).state,
      LIVE_SESSION_STATE.COMPLETED,
    );
  },
);

test(
  'after a restart hosts count as disconnected until they reconnect',
  { skip: liveSkip },
  async (t) => {
    const h = await startLiveHarness(t, ['host', 'player'] as const);
    const { liveSessionId } = await h.openQuiz('Restart', ['player']);
    const host = await h.joinAs(liveSessionId, 'host');
    h.ok(await host.emit(LIVE_EVENTS.quizStart));
    host.socket.disconnect();
    // The disconnect is recorded (asynchronously).
    for (let i = 0; i < 50; i++) {
      const row = await h.db.liveQuizSession.findUniqueOrThrow({
        where: { id: liveSessionId },
      });
      if (row.hostDisconnectedAt) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    await h.db.liveQuizSession.update({
      where: { id: liveSessionId },
      data: { hostDisconnectedAt: null },
    });
    await h.live.recoverDeadlines();
    const marked = await h.db.liveQuizSession.findUniqueOrThrow({
      where: { id: liveSessionId },
    });
    assert.ok(marked.hostDisconnectedAt, 'counted as away after a restart');
    // The host reconnects within the grace period: the session continues.
    await h.joinAs(liveSessionId, 'host');
    for (let i = 0; i < 50; i++) {
      const row = await h.db.liveQuizSession.findUniqueOrThrow({
        where: { id: liveSessionId },
      });
      if (!row.hostDisconnectedAt) return;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.fail('reconnecting clears the host disconnect');
  },
);
