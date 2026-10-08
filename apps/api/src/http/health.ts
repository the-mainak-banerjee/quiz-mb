import type { RequestHandler } from 'express';
import { CACHE_NO_STORE } from '../config/constants.js';
import { HTTP_HEADER } from '@quizmb/contracts';
/** Liveness endpoint, also the platform health check path. */
export const HEALTH_PATH = '/api/health';
export const health: RequestHandler = (_req, res) => {
  res.setHeader(HTTP_HEADER.CACHE_CONTROL, CACHE_NO_STORE);
  res.json({ status: 'ok' });
};
