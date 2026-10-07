import type { Prisma, PrismaClient } from '@quizmb/database';
import { ERROR_CODE } from '@quizmb/contracts';
import { ApiError } from '../../http/api-error.js';
import {
  DAY_MS,
  secondsUntil,
  waitText,
  windowReopens,
} from '../../infrastructure/rolling-window.js';

export type UsageKind = 'QUIZ_CREATED' | 'MEDIA_UPLOADED';

/**
 * Locks the account's row for the rest of the transaction, so its
 * allowances and quotas are counted and used one request at a time
 * (other tabs, scripts and retries queue behind it).
 */
export async function lockAccount(
  tx: Prisma.TransactionClient,
  userId: string,
) {
  await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`;
}

/**
 * Refuses when the account already used `limit` of this allowance in the
 * last 24 hours. Events are never deleted with what they count, so deleting
 * a quiz or image does not give the allowance back.
 */
export async function requireAllowance(
  tx: Prisma.TransactionClient,
  userId: string,
  kind: UsageKind,
  limit: number,
  describe: (wait: string) => string,
) {
  const events = await tx.usageEvent.findMany({
    where: { userId, kind, createdAt: { gt: new Date(Date.now() - DAY_MS) } },
    orderBy: { createdAt: 'asc' },
    select: { createdAt: true },
  });
  const reopens = windowReopens(
    events.map((event) => event.createdAt),
    limit,
    DAY_MS,
  );
  if (!reopens) return;
  const wait = secondsUntil(reopens);
  throw new ApiError(429, ERROR_CODE.LIMIT_REACHED, describe(waitText(wait)), {
    retryAfterSeconds: String(wait),
  });
}

/** Usage rows no rolling window needs any more (kept two days). */
export async function trimUsageEvents(
  db: Pick<PrismaClient, 'usageEvent'>,
  now = Date.now(),
) {
  const { count } = await db.usageEvent.deleteMany({
    where: { createdAt: { lt: new Date(now - 2 * DAY_MS) } },
  });
  return { usageEvents: count };
}

export function recordUsage(
  tx: Prisma.TransactionClient,
  userId: string,
  kind: UsageKind,
) {
  return tx.usageEvent.create({ data: { userId, kind } });
}
