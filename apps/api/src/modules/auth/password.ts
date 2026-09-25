import { hash, verify, argon2id } from 'argon2';
import { randomBytes } from 'node:crypto';
export function hashPassword(password: string) {
  return hash(password, {
    type: argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}
let dummyHash: Promise<string> | undefined;
export async function verifyPassword(password: string, passwordHash?: string) {
  // Unknown users still pay the password-verification cost.
  const candidate =
    passwordHash ??
    (await (dummyHash ??= hashPassword(randomBytes(32).toString('hex'))));
  const valid = await verify(candidate, password);
  return Boolean(passwordHash) && valid;
}
