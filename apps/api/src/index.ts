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

const env = parseEnv(process.env);
const authConfig = parseAuthEnv(process.env);
export const database = createDatabase(
  authConfig.DATABASE_URL,
  authConfig.DATABASE_SSL_CA_BASE64,
);
export const events = new DomainEvents();
export const logger = createLogger(env.LOG_LEVEL);
const storage = createStorage(process.env);
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
  auth: new AuthService(new AuthRepository(database), authConfig),
  users: new UsersService(database),
  production: env.NODE_ENV === NODE_ENV.PRODUCTION,
  database,
  storage,
  live,
  events,
});
