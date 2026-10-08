import { randomUUID } from 'node:crypto';
import type { Request, RequestHandler } from 'express';
import type { Logger } from 'pino';
import { HTTP_HEADER } from '@quizmb/contracts';
import { HEALTH_PATH } from './health.js';

/**
 * The matched route pattern with its mount path, e.g.
 * `/api/quizzes/:id/register`. Never the raw URL, so ids and query strings
 * stay out of logs. Undefined when no route matched (404s). The mount path
 * is rebuilt from the request path because Express resets `req.baseUrl`
 * once an error leaves the router.
 */
function routePattern(req: Request) {
  const pattern: unknown = req.route?.path;
  if (typeof pattern !== 'string') return undefined;
  const trim = (value: string) => value.replace(/\/+$/, '');
  const segments = trim(req.originalUrl.split('?')[0] ?? '').split('/');
  // Both start with an empty segment (the leading slash), so the extra
  // segments of the request path are its mount path.
  const mount = segments.length - trim(pattern).split('/').length;
  return segments.slice(0, Math.max(mount, 0) + 1).join('/') + pattern;
}

export function requestContext(logger: Logger): RequestHandler {
  return (req, res, next) => {
    const requestId = randomUUID();
    const start = performance.now();
    res.locals.requestId = requestId;
    res.setHeader(HTTP_HEADER.REQUEST_ID, requestId);
    res.on('finish', () => {
      const route = routePattern(req);
      // The platform health check runs every few seconds; only failures are
      // worth a line.
      if (route === HEALTH_PATH && res.statusCode < 400) return;
      // Do not log headers, bodies, query strings, or raw URL paths.
      logger.info(
        {
          requestId,
          method: req.method,
          route,
          statusCode: res.statusCode,
          durationMs: Math.round(performance.now() - start),
        },
        'Request completed',
      );
    });
    next();
  };
}
