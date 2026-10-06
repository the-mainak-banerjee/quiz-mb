import assert from 'node:assert/strict';
import type { MemoryMailbox } from '../src/infrastructure/email.js';

type Request = (
  path: string,
  method?: string,
  body?: unknown,
) => Promise<Response>;

/**
 * Signs up and verifies the email with the code from the test mailbox.
 * Resolves with the verify-email response, which carries the session
 * cookies (signup itself never signs in).
 */
export async function signUpVerified(
  request: Request,
  mailbox: MemoryMailbox,
  input: { name: string; email: string; password: string },
  prefix = '',
) {
  const signup = await request(`${prefix}/auth/signup`, 'POST', input);
  const body = (await signup.json()) as {
    data: { verification: { ticket: string } };
  };
  assert.equal(signup.status, 201, JSON.stringify(body));
  const code = await mailbox.codeFor(input.email.trim().toLowerCase());
  const verified = await request(`${prefix}/auth/verify-email`, 'POST', {
    ticket: body.data.verification.ticket,
    code,
  });
  assert.equal(verified.status, 200, 'the emailed code verifies the account');
  return verified;
}
