import { Redis } from 'ioredis';

/**
 * Single shared Redis connection, tuned for the Upstash free tier: no ready
 * check (saves an INFO call per connect), no offline queue (fail fast instead
 * of piling commands up while disconnected) and bounded retries. Callers must
 * avoid polling, KEYS/SCAN and pub/sub so monthly command usage stays small.
 */
export function createRedis(url: string) {
  return new Redis(url, {
    lazyConnect: true,
    enableReadyCheck: false,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 10_000,
    retryStrategy: (attempt) => Math.min(attempt * 500, 5_000),
  });
}

export type RedisClient = ReturnType<typeof createRedis>;
