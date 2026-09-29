import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { SocketTickets } from '../src/modules/live-sessions/tickets.js';
import { Tokens } from '../src/modules/auth/tokens.js';
import type { AuthConfig } from '../src/modules/auth/config.js';

const secret = 'a'.repeat(48);

test('socket tickets round-trip the user and live session', async () => {
  const tickets = new SocketTickets(secret);
  const userId = randomUUID();
  const liveSessionId = randomUUID();
  const { ticket, expiresAt } = await tickets.issue(userId, liveSessionId);
  assert.deepEqual(await tickets.verify(ticket), { userId, liveSessionId });
  assert.ok(Date.parse(expiresAt) > Date.now());
});

test('socket tickets reject expiry, tampering, other secrets and access tokens', async () => {
  const tickets = new SocketTickets(secret);
  const userId = randomUUID();
  const liveSessionId = randomUUID();
  const expired = await tickets.issue(
    userId,
    liveSessionId,
    Date.now() - 120_000,
  );
  await assert.rejects(tickets.verify(expired.ticket), {
    code: 'UNAUTHENTICATED',
  });

  const { ticket } = await tickets.issue(userId, liveSessionId);
  await assert.rejects(tickets.verify(`${ticket}x`), {
    code: 'UNAUTHENTICATED',
  });
  await assert.rejects(new SocketTickets('b'.repeat(48)).verify(ticket), {
    code: 'UNAUTHENTICATED',
  });
  await assert.rejects(tickets.verify(undefined), { code: 'UNAUTHENTICATED' });

  // A REST access token signed with the same secret is not a socket ticket.
  const access = await new Tokens({
    AUTH_ACCESS_SECRET: secret,
    AUTH_ACCESS_TTL_SECONDS: 900,
  } as AuthConfig).issue(userId, randomUUID());
  await assert.rejects(tickets.verify(access), { code: 'UNAUTHENTICATED' });
});
