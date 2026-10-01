import type { RequestHandler } from 'express';
import { ApiError } from './api-error.js';
import {
  ERROR_CODE,
  CONTENT_TYPE,
  HTTP_HEADER,
  HTTP_METHOD,
} from '@quizmb/contracts';

const SAFE_METHODS: string[] = [
  HTTP_METHOD.GET,
  HTTP_METHOD.HEAD,
  HTTP_METHOD.OPTIONS,
];

export function csrf(allowedOrigins: readonly string[]): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.includes(req.method)) return next();
    // Includes login CSRF. Direct browser requests must match an exact origin.
    const origin = req.get(HTTP_HEADER.ORIGIN);
    if (!origin || !allowedOrigins.includes(origin))
      return next(
        new ApiError(
          403,
          ERROR_CODE.FORBIDDEN,
          'Request origin is not allowed.',
        ),
      );
    // DELETE intentionally has no body; req.is() returns null for empty bodies.
    const emptyJsonDelete =
      req.method === HTTP_METHOD.DELETE &&
      req.get(HTTP_HEADER.CONTENT_TYPE)?.split(';')[0]?.trim().toLowerCase() ===
        CONTENT_TYPE.JSON &&
      !req.get(HTTP_HEADER.TRANSFER_ENCODING) &&
      (!req.get(HTTP_HEADER.CONTENT_LENGTH) ||
        req.get(HTTP_HEADER.CONTENT_LENGTH) === '0');
    if (!req.is(CONTENT_TYPE.JSON) && !emptyJsonDelete)
      return next(
        new ApiError(
          415,
          ERROR_CODE.VALIDATION_ERROR,
          'Expected application/json.',
        ),
      );
    next();
  };
}
