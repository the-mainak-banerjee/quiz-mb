import express from 'express';
import cors from 'cors';
import type { Logger } from 'pino';
import { requestContext } from './http/request-context.js';
import { HEALTH_PATH, health } from './http/health.js';
import { authRoutes } from './modules/auth/routes.js';
import type { AuthService } from './modules/auth/service.js';
import type { UsersService } from './modules/users/service.js';
import { notFound } from './http/not-found.js';
import { errorHandler } from './http/error-handler.js';
import type { PrismaClient } from '@quizmb/database';
import { authoringRoutes, publicAuthoringRoutes } from './modules/authoring.js';
import { authenticate } from './http/authenticate.js';
import { csrf } from './http/csrf.js';
import type { SupabaseStorage } from './modules/media/storage.js';
import type { LiveSessionsService } from './modules/live-sessions/service.js';
import { liveSessionRoutes } from './modules/live-sessions/routes.js';
import type { DomainEvents } from './infrastructure/domain-events.js';
import { HTTP_HEADER, HTTP_METHOD } from '@quizmb/contracts';
import type { RateLimiter } from './infrastructure/rate-limiter.js';
import { RATE_LIMITS, type RateLimits } from './config/rate-limits.js';
import { authRateLimits, userRateLimits } from './http/rate-limit.js';

export function createApp({
  allowedOrigins,
  logger,
  auth,
  users,
  production = false,
  database,
  storage,
  live,
  events,
  rateLimiter,
  rateLimits = RATE_LIMITS,
  trustProxyHops = 0,
}: {
  allowedOrigins: readonly string[];
  logger: Logger;
  auth?: AuthService;
  users?: UsersService;
  production?: boolean;
  database?: PrismaClient;
  storage?: SupabaseStorage | undefined;
  live?: LiveSessionsService | undefined;
  events?: DomainEvents | undefined;
  /** Without one, nothing is rate limited (tests and REST-only runs). */
  rateLimiter?: RateLimiter | undefined;
  rateLimits?: RateLimits;
  /** Proxies in front of the API whose X-Forwarded-For entry is trusted. */
  trustProxyHops?: number;
}) {
  const app = express();
  app.disable('x-powered-by');
  if (trustProxyHops) app.set('trust proxy', trustProxyHops);
  app.use(requestContext(logger));
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, origin !== undefined && allowedOrigins.includes(origin)),
      methods: Object.values(HTTP_METHOD),
      credentials: true,
      exposedHeaders: [HTTP_HEADER.REQUEST_ID],
    }),
  );
  app.get(HEALTH_PATH, health);
  app.use(express.json({ limit: '128kb' }));
  if (rateLimiter) app.use('/api', authRateLimits(rateLimiter, rateLimits));
  if (auth && users)
    app.use('/api', authRoutes(auth, users, production, allowedOrigins));
  if (database) app.use('/api', publicAuthoringRoutes(database, storage));
  if (auth && database)
    app.use(
      '/api',
      authenticate(auth, production),
      csrf(allowedOrigins),
      ...(rateLimiter ? [userRateLimits(rateLimiter, rateLimits)] : []),
      authoringRoutes(database, storage, events, logger),
      ...(live ? [liveSessionRoutes(live)] : []),
    );
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
