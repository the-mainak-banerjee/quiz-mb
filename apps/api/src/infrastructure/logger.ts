import pino from 'pino';

export function createLogger(level: string) {
  return pino({
    level,
    base: { service: 'quizmb-api' },
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
