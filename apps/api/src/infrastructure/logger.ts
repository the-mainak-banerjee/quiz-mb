import pino from 'pino';
import { SERVICE_NAME } from '../config/constants.js';

export function createLogger(level: string) {
  return pino({
    level,
    base: { service: SERVICE_NAME },
    redact: {
      paths: [
        'password',
        'passwordHash',
        'refresh',
        'refreshToken',
        'refreshTokenHash',
        'access',
        'res.headers.set-cookie',
        'token',
        'authorization',
        'cookie',
        'req.headers.authorization',
        'req.headers.cookie',
      ],
      censor: '[REDACTED]',
    },
  });
}
