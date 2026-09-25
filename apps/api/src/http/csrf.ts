import type { RequestHandler } from 'express';
import { ApiError } from './api-error.js';
export function csrf(allowedOrigins: readonly string[]): RequestHandler {
  return (req, _res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    // Includes login CSRF. Direct browser requests must match an exact origin.
    if (!req.headers.origin || !allowedOrigins.includes(req.headers.origin))
      return next(
        new ApiError(403, 'FORBIDDEN', 'Request origin is not allowed.'),
      );
    if (!req.is('application/json'))
      return next(
        new ApiError(415, 'VALIDATION_ERROR', 'Expected application/json.'),
      );
    next();
  };
}
