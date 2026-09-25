import express from 'express';
import cors from 'cors';
import type { Logger } from 'pino';
import { requestContext } from './http/request-context.js';
import { health } from './http/health.js';
import { authRoutes } from './modules/auth/routes.js';
import type { AuthService } from './modules/auth/service.js';
import type { UsersService } from './modules/users/service.js';
import { notFound } from './http/not-found.js';
import { errorHandler } from './http/error-handler.js';

export function createApp({
  allowedOrigins,
  logger,
  auth,
  users,
  production = false,
}: {
  allowedOrigins: readonly string[];
  logger: Logger;
  auth?: AuthService;
  users?: UsersService;
  production?: boolean;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext(logger));
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, origin !== undefined && allowedOrigins.includes(origin)),
      methods: ['GET', 'HEAD', 'OPTIONS', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
      exposedHeaders: ['X-Request-ID'],
    }),
  );
  app.get('/api/health', health);
  app.use(express.json({ limit: '16kb' }));
  if (auth && users)
    app.use('/api', authRoutes(auth, users, production, allowedOrigins));
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
