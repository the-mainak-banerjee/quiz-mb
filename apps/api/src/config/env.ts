import { z } from 'zod';
import { NODE_ENV } from './constants.js';

const origin = z.url().refine((value) => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return ['http:', 'https:'].includes(url.protocol) && url.origin === value;
}, 'Expected an HTTP(S) origin without a path or trailing slash');

const schema = z.object({
  NODE_ENV: z.enum(NODE_ENV).default(NODE_ENV.DEVELOPMENT),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  HOST: z.string().min(1).default('localhost'),
  ALLOWED_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) => value.split(',').map((item) => item.trim()))
    .pipe(z.array(origin).min(1)),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  // Live sessions (Redis-backed presence and locks). Upstash: rediss:// URL.
  REDIS_URL: z
    .url()
    .refine((value) => ['redis:', 'rediss:'].includes(new URL(value).protocol))
    .optional(),
});

export function parseEnv(input: Record<string, string | undefined>) {
  const result = schema.safeParse(input);
  if (!result.success) {
    const fields = [
      ...new Set(result.error.issues.map((issue) => issue.path[0])),
    ];
    throw new Error(`Invalid API environment: ${fields.join(', ')}`);
  }
  if (result.data.NODE_ENV === NODE_ENV.PRODUCTION && !input.ALLOWED_ORIGINS) {
    throw new Error(
      'ALLOWED_ORIGINS must be explicitly configured in production',
    );
  }
  if (result.data.NODE_ENV === NODE_ENV.PRODUCTION && !result.data.REDIS_URL) {
    throw new Error('REDIS_URL must be configured in production');
  }
  return result.data;
}
