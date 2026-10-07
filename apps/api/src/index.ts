import { createApp } from './app.js';
import { parseEnv } from './config/env.js';
import { createLogger } from './infrastructure/logger.js';
import { createDatabase } from '@quizmb/database';
import { parseAuthEnv } from './modules/auth/config.js';
import { createStorage } from './modules/media/storage.js';
import { MediaService } from './modules/media/service.js';
import { AuthRepository } from './modules/auth/repository.js';
import { AuthService } from './modules/auth/service.js';
import { UsersService } from './modules/users/service.js';
import { createRedis } from './infrastructure/redis.js';
import { DomainEvents } from './infrastructure/domain-events.js';
import { LiveSessionsRepository } from './modules/live-sessions/repository.js';
import { LiveSessionsService } from './modules/live-sessions/service.js';
import { LiveStore } from './modules/live-sessions/live-store.js';
import { SocketTickets } from './modules/live-sessions/tickets.js';
import { NODE_ENV } from './config/constants.js';
import { RateLimiter } from './infrastructure/rate-limiter.js';
import { ResendEmailSender } from './infrastructure/email.js';
import { LoginThrottle } from './modules/auth/login-throttle.js';

const env = parseEnv(process.env);
const authConfig = parseAuthEnv(process.env);
export const database = createDatabase(
  authConfig.DATABASE_URL,
  authConfig.DATABASE_SSL_CA_BASE64,
  env.DATABASE_POOL_MAX,
);
export const events = new DomainEvents();
export const authRepository = new AuthRepository(database);
export const logger = createLogger(env.LOG_LEVEL);
const storage = createStorage(process.env);
/** Media service for background maintenance (abandoned and orphaned images). */
export const mediaMaintenance = new MediaService(database, storage, logger);
// Live sessions need Redis; without REDIS_URL the REST-only API still runs.
export const redis = env.REDIS_URL ? createRedis(env.REDIS_URL) : undefined;
export const live = redis
  ? new LiveSessionsService(
      new LiveSessionsRepository(database),
      new LiveStore(redis),
      new SocketTickets(authConfig.AUTH_ACCESS_SECRET),
      events,
      new MediaService(database, storage),
      logger,
    )
  : undefined;
export default createApp({
  allowedOrigins: env.ALLOWED_ORIGINS,
  logger,
  auth: new AuthService(
    authRepository,
    authConfig,
    env.RESEND_API_KEY && env.EMAIL_FROM
      ? new ResendEmailSender(env.RESEND_API_KEY, env.EMAIL_FROM, logger)
      : undefined,
    {
      supportEmail: env.SUPPORT_EMAIL,
      logger,
      dailyEmailLimit: env.EMAIL_DAILY_LIMIT,
    },
    {
      // The wrong-password pause lives in Redis, like the rate limits.
      loginThrottle: redis ? new LoginThrottle(redis, logger) : undefined,
      events,
    },
  ),
  users: new UsersService(database),
  production: env.NODE_ENV === NODE_ENV.PRODUCTION,
  database,
  storage,
  live,
  events,
  rateLimiter: new RateLimiter(redis, logger),
  trustProxyHops: env.TRUST_PROXY_HOPS,
});
