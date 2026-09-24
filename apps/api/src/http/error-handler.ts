import type { ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';

export function errorHandler(logger: Logger): ErrorRequestHandler {
  return (_error: unknown, _req, res, next) => {
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
