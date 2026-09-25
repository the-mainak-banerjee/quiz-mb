import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { ApiError } from './api-error.js';

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (_error: unknown, _req, res, next) => {
    const error =
      _error instanceof ApiError
        ? _error
        : _error instanceof SyntaxError && 'body' in _error
          ? new ApiError(400, 'VALIDATION_ERROR', 'Invalid JSON body.')
          : _error instanceof Error &&
              'type' in _error &&
              _error.type === 'entity.too.large'
            ? new ApiError(
                413,
                'VALIDATION_ERROR',
                'Request body is too large.',
              )
            : null;
    if (error && !res.headersSent) {
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
      { requestId: res.locals.requestId, code: 'INTERNAL_ERROR' },
      'Request failed',
    );
    if (res.headersSent) {
      next(_error);
      return;
    }
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred.',
        requestId: res.locals.requestId,
      },
    });
  };
}
