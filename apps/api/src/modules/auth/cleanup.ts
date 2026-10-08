import type { Logger } from 'pino';
import type { AuthRepository } from './repository.js';

/** Accounts that never verified their email are deleted after this long. */
export const UNVERIFIED_ACCOUNT_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;
/** Email events are needed for 24 hours at most; kept two days. */
export const EMAIL_EVENT_RETENTION_MS = 2 * 24 * 60 * 60 * 1000;
/** How often the cleanup runs (and once at startup). */
export const AUTH_CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * One cleanup pass: never-verified accounts older than 7 days (with their
 * codes and email events) and email events older than two days. Safe to run
 * on several instances at once: each is a single conditional DELETE.
 */
export async function cleanUpAuth(
  repository: Pick<
    AuthRepository,
    'deleteNeverVerified' | 'deleteEmailEventsBefore'
  >,
  now = Date.now(),
) {
  const accounts = await repository.deleteNeverVerified(
    new Date(now - UNVERIFIED_ACCOUNT_RETENTION_MS),
  );
  const emailEvents = await repository.deleteEmailEventsBefore(
    new Date(now - EMAIL_EVENT_RETENTION_MS),
  );
  return { accounts, emailEvents };
}

/**
 * Runs maintenance tasks now and every hour; each task's failure is logged
 * without stopping the others. Returns a function that stops it.
 */
export function startMaintenance(
  tasks: Record<string, () => Promise<Record<string, number>>>,
  logger: Pick<Logger, 'info' | 'error'>,
) {
  const run = async () => {
    for (const [name, task] of Object.entries(tasks)) {
      try {
        const removed = await task();
        if (Object.values(removed).some(Boolean))
          logger.info(
            { task: name, ...removed },
            'Maintenance removed stale records',
          );
      } catch (error) {
        logger.error({ err: error, task: name }, 'Maintenance task failed');
      }
    }
  };
  void run();
  const timer = setInterval(() => void run(), AUTH_CLEANUP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
