import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { ApiError } from './api-error.js';
import { ERROR_CODE, HTTP_HEADER } from '@quizmb/contracts';

/** Seconds a client should wait before retrying a SERVICE_BUSY response. */
const BUSY_RETRY_AFTER_SECONDS = 2;

/**
 * The database is saturated: no pool connection freed up in time (pg-pool's
 * fixed message) or Prisma could not start a transaction in time (P2028).
 * Nothing was changed, so the request is safe to retry.
 */
function isDatabaseBusy(error: unknown) {
  return (
    error instanceof Error &&
    (error.message === 'timeout exceeded when trying to connect' ||
      (error as { code?: unknown }).code === 'P2028')
  );
}

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (_error: unknown, _req, res, next) => {
    const error =
      _error instanceof ApiError
        ? _error
        : _error instanceof SyntaxError && 'body' in _error
          ? new ApiError(400, ERROR_CODE.VALIDATION_ERROR, 'Invalid JSON body.')
          : _error instanceof Error &&
              'type' in _error &&
              _error.type === 'entity.too.large'
            ? new ApiError(
                413,
                ERROR_CODE.VALIDATION_ERROR,
                'Request body is too large.',
              )
            : isDatabaseBusy(_error)
              ? new ApiError(
                  503,
                  ERROR_CODE.SERVICE_BUSY,
                  'The server is busy. Please try again in a moment.',
                )
              : null;
    if (error && !res.headersSent) {
      if (error.code === ERROR_CODE.SERVICE_BUSY) {
        logger.warn(
          { requestId: res.locals.requestId, code: error.code },
          'Request refused: database busy',
        );
        res.setHeader(
          HTTP_HEADER.RETRY_AFTER,
          String(BUSY_RETRY_AFTER_SECONDS),
        );
      }
      res.status(error.status).json({
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          requestId: res.locals.requestId,
        },
      });
      return;
    }
    logger.error(
      { requestId: res.locals.requestId, code: ERROR_CODE.INTERNAL_ERROR },
      'Request failed',
    );
    if (res.headersSent) {
      next(_error);
      return;
    }
    res.status(500).json({
      success: false,
      error: {
        code: ERROR_CODE.INTERNAL_ERROR,
        message: 'An unexpected error occurred.',
        requestId: res.locals.requestId,
      },
    });
  };
}
