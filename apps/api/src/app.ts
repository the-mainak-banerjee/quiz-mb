import express from 'express';
import cors from 'cors';
import type { Logger } from 'pino';
import { requestContext } from './http/request-context.js';
import { health } from './http/health.js';
import { notFound } from './http/not-found.js';
import { errorHandler } from './http/error-handler.js';

export function createApp({
  allowedOrigins,
  logger,
}: {
  allowedOrigins: readonly string[];
  logger: Logger;
}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestContext(logger));
  app.use(
    cors({
      origin: (origin, callback) =>
        callback(null, origin !== undefined && allowedOrigins.includes(origin)),
      methods: ['GET', 'HEAD', 'OPTIONS'],
      credentials: false,
      exposedHeaders: ['X-Request-ID'],
    }),
  );
  app.get('/api/health', health);
  app.use(notFound);
  app.use(errorHandler(logger));
  return app;
}
