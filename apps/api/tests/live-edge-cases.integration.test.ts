import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ERROR_CODE,
  LIVE_EVENTS,
  LIVE_SESSION_STATE,
  type HostLiveSnapshotDto,
  type HostQuizResultsDto,
  type LiveHostPresenceDto,
  type ParticipantFinalResultDto,
  type ParticipantLiveSnapshotDto,
} from '@quizmb/contracts';
import { HOST_AWAY_GRACE_MS } from '../src/modules/live-sessions/constants.js';
import { LiveSessionsRepository } from '../src/modules/live-sessions/repository.js';
import { LiveStore } from '../src/modules/live-sessions/live-store.js';
import { liveSkip, singleChoice, startLiveHarness } from './live-harness.js';

// Short enough to wait for the timer, long enough for remote round trips.
const SHORT = 6;

test(
  'live edge cases: empty rooms, ending from every state, replaced devices',
  { skip: liveSkip },
  async (t) => {
    const harness = await startLiveHarness(t, ['host', 'p1', 'p2'] as const);
    const { db, live, request, data, openQuiz, joinAs } = harness;
    const { waitFor, nextEvent, ok, errorCode, userIds, cookies } = harness;

    /** Host joins and starts; returns the host connection and live view. */
    async function startAsHost(liveSessionId: string) {
      const host = await joinAs(liveSessionId, 'host');
      const view = ok(
        await host.emit<HostLiveSnapshotDto>(LIVE_EVENTS.quizStart),
      );
      return { host, view };
    }
    const optionId = (view: HostLiveSnapshotDto, index: number, text: string) =>
      view.questions[index]!.options.find((option) => option.text === text)!.id;
    const finalFor = (socket: Parameters<typeof nextEvent>[0]) =>
      nextEvent<ParticipantFinalResultDto>(socket, LIVE_EVENTS.quizEnded);
    const end = async (host: Awaited<ReturnType<typeof joinAs>>) => {
      const ended = ok(
        await host.emit<HostLiveSnapshotDto>(LIVE_EVENTS.quizEnd),
      );
      assert.equal(ended.state, LIVE_SESSION_STATE.COMPLETED);
      return ended;
    };

    await t.test(
      'nobody joins: the quiz still runs and ends cleanly',
      async () => {
        const { quiz, liveSessionId } = await openQuiz('Empty room', []);
        const { host, view } = await startAsHost(liveSessionId);
        ok(
          await host.emit(LIVE_EVENTS.questionStart, {
            questionId: view.questions[0]!.id,
          }),
        );
        const ended = await end(host);
        assert.deepEqual(ended.final?.summary, {
          ...ended.final!.summary,
          participantCount: 0,
          askedQuestionCount: 1,
          scoredQuestionCount: 1,
          averageScore: 0,
        });
        assert.deepEqual(ended.final?.leaderboard.entries, []);
        assert.equal(
          await db.quizResult.count({ where: { liveSessionId } }),
          0,
        );
        const results = await data<HostQuizResultsDto>(
          await request(
            `/quizzes/${quiz.id}/results`,
            'GET',
            undefined,
            cookies.host,
          ),
        );
        assert.equal(results.summary.participantCount, 0);
        assert.deepEqual(results.entries, []);
        assert.equal(results.nextOffset, null);
      },
    );

    await t.test(
      'ending before any question asked scores nothing',
      async () => {
        const { liveSessionId } = await openQuiz('Nothing asked', ['p1', 'p2']);
        const { host } = await startAsHost(liveSessionId);
        const p1 = await joinAs(liveSessionId, 'p1');
        const p2 = await joinAs(liveSessionId, 'p2');
        const finals = Promise.all([finalFor(p1.socket), finalFor(p2.socket)]);
        const ended = await end(host);
        const empty = {
          totalScore: 0,
          rank: 1,
          participantCount: 2,
          correctCount: 0,
          incorrectCount: 0,
          notAttemptedCount: 0,
        };
        assert.deepEqual(await finals, [empty, empty], 'everyone ties at zero');
        assert.equal(ended.final?.summary.askedQuestionCount, 0);
        assert.equal(ended.final?.summary.scoredQuestionCount, 0);
        assert.deepEqual(ended.final?.leaderboard.entries, []);
        assert.equal(
          await db.quizResult.count({ where: { liveSessionId } }),
          2,
        );
      },
    );

    /**
     * Asks the first question, p1 answers correctly and p2 does not answer;
     * resolves once both participants see the result.
     */
    async function answeredQuestion(title: string) {
      const { liveSessionId } = await openQuiz(
        title,
        ['p1', 'p2'],
        [singleChoice('Short question', SHORT)],
      );
      const { host, view } = await startAsHost(liveSessionId);
      const p1 = await joinAs(liveSessionId, 'p1');
      const p2 = await joinAs(liveSessionId, 'p2');
      const asked = ok(
        await host.emit<HostLiveSnapshotDto>(LIVE_EVENTS.questionStart, {
          questionId: view.questions[0]!.id,
        }),
      ).currentQuestion!.askedQuestionId;
      ok(
        await p1.emit(LIVE_EVENTS.answerSubmit, {
          askedQuestionId: asked,
          selectedOptionIds: [optionId(view, 0, 'Right')],
        }),
      );
      const resultIn = (socket: typeof p1.socket) =>
        waitFor<ParticipantLiveSnapshotDto>(
          socket,
          LIVE_EVENTS.snapshot,
          (snapshot) =>
            snapshot.state === LIVE_SESSION_STATE.QUESTION_RESULT &&
            snapshot.question?.askedQuestionId === asked,
        );
      await Promise.all([resultIn(p1.socket), resultIn(p2.socket)]);
      return { liveSessionId, host, p1, p2 };
    }
    const assertAnsweredFinals = (
      [p1Final, p2Final]: ParticipantFinalResultDto[],
      label: string,
    ) => {
      assert.ok(p1Final!.totalScore > 0, label);
      assert.deepEqual(
        { ...p1Final, totalScore: 0 },
        {
          totalScore: 0,
          rank: 1,
          participantCount: 2,
          correctCount: 1,
          incorrectCount: 0,
          notAttemptedCount: 0,
        },
        label,
      );
      assert.deepEqual(
        p2Final,
        {
          totalScore: 0,
          rank: 2,
          participantCount: 2,
          correctCount: 0,
          incorrectCount: 0,
          notAttemptedCount: 1,
        },
        label,
      );
    };

    await t.test(
      'ending from the question result keeps that question',
      async () => {
        const { host, p1, p2 } = await answeredQuestion('End from result');
        const finals = Promise.all([finalFor(p1.socket), finalFor(p2.socket)]);
        const ended = await end(host);
        assertAnsweredFinals(await finals, 'ended from QUESTION_RESULT');
        assert.equal(ended.final?.summary.askedQuestionCount, 1);
        assert.equal(ended.final?.leaderboardShown, false);
      },
    );

    await t.test('ending while the leaderboard is shown hides it', async () => {
      const { host, p1, p2 } = await answeredQuestion('End from leaderboard');
      const shown = ok(
        await host.emit<HostLiveSnapshotDto>(LIVE_EVENTS.leaderboardShow),
      );
      assert.equal(shown.state, LIVE_SESSION_STATE.LEADERBOARD);
      const finals = Promise.all([finalFor(p1.socket), finalFor(p2.socket)]);
      const ended = await end(host);
      assertAnsweredFinals(await finals, 'ended from LEADERBOARD');
      assert.equal(ended.leaderboard, null);
      assert.equal(ended.final?.leaderboardShown, false, 'final stays private');
    });

    await t.test(
      'ending during a question keeps answers already accepted',
      async () => {
        const { liveSessionId } = await openQuiz('End mid-question', [
          'p1',
          'p2',
        ]);
        const { host, view } = await startAsHost(liveSessionId);
        const p1 = await joinAs(liveSessionId, 'p1');
        const p2 = await joinAs(liveSessionId, 'p2');
        const asked = ok(
          await host.emit<HostLiveSnapshotDto>(LIVE_EVENTS.questionStart, {
            questionId: view.questions[0]!.id,
          }),
        ).currentQuestion!.askedQuestionId;
        for (const [participant, option] of [
          [p1, 'Right'],
          [p2, 'Wrong'],
        ] as const)
          ok(
            await participant.emit(LIVE_EVENTS.answerSubmit, {
              askedQuestionId: asked,
              selectedOptionIds: [optionId(view, 0, option)],
            }),
          );
        const finals = Promise.all([finalFor(p1.socket), finalFor(p2.socket)]);
        await end(host);
        const [p1Final, p2Final] = await finals;
        assert.ok(p1Final!.totalScore > 0, 'the accepted answer is scored');
        assert.equal(p1Final!.rank, 1);
        assert.equal(p1Final!.correctCount, 1);
        assert.deepEqual(p2Final, {
          totalScore: 0,
          rank: 2,
          participantCount: 2,
          correctCount: 0,
          incorrectCount: 1,
          notAttemptedCount: 0,
        });
      },
    );

    await t.test(
      'a replaced device can neither answer nor stay active',
      async () => {
        const { liveSessionId } = await openQuiz('Replaced device', ['p1']);
        const { host, view } = await startAsHost(liveSessionId);
        const first = await joinAs(liveSessionId, 'p1');
        const firstId = first.socket.id!;
        const replaced = nextEvent(first.socket, LIVE_EVENTS.replaced);
        const disconnected = nextEvent(first.socket, 'disconnect');
        const second = await joinAs(liveSessionId, 'p1');
        await replaced;
        await disconnected;
        assert.equal(
          await live.isActiveSocket(liveSessionId, userIds.p1, firstId),
          false,
        );
        const asked = ok(
          await host.emit<HostLiveSnapshotDto>(LIVE_EVENTS.questionStart, {
            questionId: view.questions[0]!.id,
          }),
        ).currentQuestion!.askedQuestionId;
        const command = {
          liveSessionId,
          askedQuestionId: asked,
          selectedOptionIds: [optionId(view, 0, 'Right')],
        };
        // A command still in flight from the old device is refused.
        await assert.rejects(
          live.submit(userIds.p1, firstId, command),
          (error: { code?: string }) =>
            error.code === ERROR_CODE.SESSION_REPLACED,
        );
        ok(await second.emit(LIVE_EVENTS.answerSubmit, command));
        assert.equal(
          errorCode(await second.emit(LIVE_EVENTS.answerSubmit, command)),
          ERROR_CODE.ALREADY_SUBMITTED,
        );
        await end(host);
      },
    );
  },
);

test(
  'live presence: host away and back, refresh grace, startup reset',
  { skip: liveSkip },
  async (t) => {
    const harness = await startLiveHarness(t, ['host', 'p1', 'p2'] as const);
    const { db, redis, openQuiz, joinAs, waitFor, ok } = harness;
    const { liveSessionId } = await openQuiz('Host presence', ['p1', 'p2']);
    const hostPresence = (
      socket: Parameters<typeof waitFor>[0],
      connected: boolean,
    ) =>
      waitFor<LiveHostPresenceDto>(
        socket,
        LIVE_EVENTS.hostPresence,
        (payload) => payload.hostConnected === connected,
      );
    const sync = async (participant: Awaited<ReturnType<typeof joinAs>>) =>
      ok(await participant.emit<ParticipantLiveSnapshotDto>(LIVE_EVENTS.sync));

    // The lobby is open but the host has not connected yet.
    const p1 = await joinAs(liveSessionId, 'p1');
    assert.equal(
      (p1.snapshot as ParticipantLiveSnapshotDto).hostConnected,
      false,
      'a host who never connected counts as away',
    );
    const arrived = hostPresence(p1.socket, true);
    let host = await joinAs(liveSessionId, 'host');
    await arrived;
    assert.equal((await sync(p1)).hostConnected, true);

    // A refresh inside the grace period is never announced as away.
    const awayEvents: LiveHostPresenceDto[] = [];
    p1.socket.on(LIVE_EVENTS.hostPresence, (payload: LiveHostPresenceDto) => {
      if (!payload.hostConnected) awayEvents.push(payload);
    });
    host.socket.disconnect();
    assert.equal((await sync(p1)).hostConnected, true, 'within the grace');
    host = await joinAs(liveSessionId, 'host');
    await new Promise((resolve) =>
      setTimeout(resolve, HOST_AWAY_GRACE_MS + 1_000),
    );
    assert.deepEqual(awayEvents, [], 'a quick refresh stays invisible');

    // A real drop is announced after the grace; the session keeps running.
    const away = hostPresence(p1.socket, false);
    host.socket.disconnect();
    await away;
    const whileAway = await sync(p1);
    assert.equal(whileAway.hostConnected, false);
    assert.equal(whileAway.state, LIVE_SESSION_STATE.LOBBY, 'nothing ends');
    const back = hostPresence(p1.socket, true);
    host = await joinAs(liveSessionId, 'host');
    await back;
    assert.equal((await sync(p1)).hostConnected, true);

    // Startup reset: presence from before a restart is dropped, and clients
    // claim it again when they reconnect.
    const p2 = await joinAs(liveSessionId, 'p2');
    const connected = async () =>
      ok(await host.emit<HostLiveSnapshotDto>(LIVE_EVENTS.sync)).counts
        .connected;
    assert.equal(await connected(), 2);
    assert.ok(
      (await new LiveSessionsRepository(db).unfinishedSessionIds()).includes(
        liveSessionId,
      ),
      'unfinished sessions are reset at startup',
    );
    // Only this test's session: other development sessions stay untouched.
    await new LiveStore(redis).resetPresence([liveSessionId]);
    assert.equal(await connected(), 0, 'stale presence is gone');
    p1.socket.disconnect();
    p2.socket.disconnect();
    await joinAs(liveSessionId, 'p1');
    assert.equal(await connected(), 1, 'a reconnect claims presence again');
  },
);
