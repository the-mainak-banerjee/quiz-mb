import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import type { Logger } from 'pino';

export function requestContext(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const requestId = randomUUID();
    const start = performance.now();
    res.locals.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    res.on('finish', () => {
      // Do not log headers, bodies, query strings, or arbitrary URL paths.
      logger.info(
        {
          requestId,
          method: req.method,
          statusCode: res.statusCode,
          durationMs: Math.round(performance.now() - start),
        },
        'Request completed',
      );
    });
    next();
  };
}
