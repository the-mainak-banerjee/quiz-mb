// Options for interactive transactions that queue on row locks. With the small
// connection pool, bursts on one row can wait longer than Prisma's 2s/5s
// defaults; waiting keeps the work serialized instead of failing with P2028.
export const lockedTransaction = { maxWait: 15_000, timeout: 15_000 };
