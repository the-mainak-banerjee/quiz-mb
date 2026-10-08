import { createHash } from 'node:crypto';
import type { Logger } from 'pino';
import type { RateRule } from '../config/rate-limits.js';
import type { RedisClient } from './redis.js';
import { ALERT } from './alerts.js';

// One command per check: increment the window's counter and give a new
// counter its expiry (TTL equals the window).
const HIT_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return count`;

const WARN_INTERVAL_MS = 60_000;

/** Identifiers (IPs, emails) never appear in Redis keys in plain text. */
const digest = (identifier: string) =>
  createHash('sha256').update(identifier).digest('base64url').slice(0, 22);

/**
 * Fixed-window counters in Redis (`rate:{scope}:{identifier}:{window}`).
 * Fails open: when Redis is unreachable requests are allowed and a warning
 * is logged (at most once a minute), so an outage never blocks sign-in.
 * Without a Redis client (local REST-only runs) nothing is limited.
 */
export class RateLimiter {
  private lastWarnAt = 0;

  constructor(
    private redis: Pick<RedisClient, 'eval'> | undefined,
    private logger: Pick<Logger, 'warn'>,
  ) {}

  /** Seconds to wait when over the limit; 0 when the request may proceed. */
  async hit(rule: RateRule, identifier: string, now = Date.now()) {
    if (!this.redis) return 0;
    const windowMs = rule.windowSeconds * 1000;
    const window = Math.floor(now / windowMs);
    const key = `rate:${rule.scope}:${digest(identifier)}:${window}`;
    try {
      const count = Number(
        await this.redis.eval(HIT_SCRIPT, 1, key, String(rule.windowSeconds)),
      );
      if (count <= rule.limit) return 0;
      // Once per identifier and window: a flood is one line, not thousands.
      if (count === rule.limit + 1)
        this.logger.warn(
          {
            scope: rule.scope,
            client: digest(identifier),
            alert: ALERT.RATE_LIMITED,
          },
          'Rate limit reached',
        );
      return Math.max(1, Math.ceil(((window + 1) * windowMs - now) / 1000));
    } catch {
      if (now - this.lastWarnAt >= WARN_INTERVAL_MS) {
        this.lastWarnAt = now;
        this.logger.warn(
          { scope: rule.scope },
          'Rate limit skipped: Redis unavailable',
        );
      }
      return 0;
    }
  }
}
