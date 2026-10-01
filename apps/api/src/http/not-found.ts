import type { RequestHandler } from 'express';
import { ERROR_CODE } from '@quizmb/contracts';
export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: ERROR_CODE.NOT_FOUND,
      message: 'Route not found.',
      requestId: res.locals.requestId,
    },
  });
};
