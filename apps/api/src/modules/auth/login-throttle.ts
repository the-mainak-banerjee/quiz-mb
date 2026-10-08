import { createHash } from 'node:crypto';
import type { Logger } from 'pino';
import { LOGIN_PAUSE } from '../../config/rate-limits.js';
import type { RedisClient } from '../../infrastructure/redis.js';

// Records one wrong password in the rolling window; the limit-th one starts
// the pause (fixed length, set only if not already running) and clears the
// count. Returns 1 when the pause started.
const FAILURE_SCRIPT = `
redis.call('ZREMRANGEBYSCORE', KEYS[1], '-inf', tonumber(ARGV[1]) - tonumber(ARGV[2]))
redis.call('ZADD', KEYS[1], ARGV[1], ARGV[5])
redis.call('PEXPIRE', KEYS[1], ARGV[2])
if redis.call('ZCARD', KEYS[1]) >= tonumber(ARGV[3]) then
  redis.call('SET', KEYS[2], '1', 'PX', ARGV[4], 'NX')
  redis.call('DEL', KEYS[1])
  return 1
end
return 0`;

const WARN_INTERVAL_MS = 60_000;

/** Email addresses never appear in Redis keys in plain text. */
const digest = (email: string) =>
  createHash('sha256').update(email).digest('base64url').slice(0, 22);

/**
 * The wrong-password pause per email address (LOGIN_PAUSE), in Redis so it
 * holds across API instances. Like the request rate limits it fails open:
 * when Redis is unreachable logins are checked normally and a warning is
 * logged, so an outage never blocks sign-in.
 */
export class LoginThrottle {
  private lastWarnAt = 0;
  private sequence = 0;

  constructor(
    private redis: Pick<RedisClient, 'eval' | 'pttl' | 'del'>,
    private logger: Pick<Logger, 'warn'>,
  ) {}

  private keys(email: string) {
    const id = digest(email);
    return { failures: `login-fail:${id}`, pause: `login-pause:${id}` };
  }

  private warn() {
    const now = Date.now();
    if (now - this.lastWarnAt < WARN_INTERVAL_MS) return;
    this.lastWarnAt = now;
    this.logger.warn('Login pause skipped: Redis unavailable');
  }

  /** Seconds left in this address's pause; 0 when password login is open. */
  async pausedFor(email: string) {
    try {
      const ms = await this.redis.pttl(this.keys(email).pause);
      return ms > 0 ? Math.ceil(ms / 1000) : 0;
    } catch {
      this.warn();
      return 0;
    }
  }

  /** Counts a wrong password; true when this one started the pause. */
  async recordFailure(email: string, now = Date.now()) {
    const { failures, pause } = this.keys(email);
    try {
      const started = await this.redis.eval(
        FAILURE_SCRIPT,
        2,
        failures,
        pause,
        String(now),
        String(LOGIN_PAUSE.windowSeconds * 1000),
        String(LOGIN_PAUSE.failures),
        String(LOGIN_PAUSE.pauseSeconds * 1000),
        // Unique member, so simultaneous failures are all counted.
        `${now}:${process.pid}:${++this.sequence}`,
      );
      return Number(started) === 1;
    } catch {
      this.warn();
      return false;
    }
  }

  /**
   * A successful login clears the failure count. A completed password reset
   * also ends a running pause: the owner proved access to the inbox.
   */
  async clear(email: string, { endPause = false } = {}) {
    const { failures, pause } = this.keys(email);
    try {
      await (endPause
        ? this.redis.del(failures, pause)
        : this.redis.del(failures));
    } catch {
      this.warn();
    }
  }
}
