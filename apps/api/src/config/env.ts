import { z } from 'zod';
import { NODE_ENV } from './constants.js';
import { PAUSABLE_FEATURE, parsePausedFeatures } from './feature-switch.js';

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
  // Connections in the API's database pool. The Supabase transaction pooler
  // (port 6543) multiplexes them, so this can exceed its server-side size.
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  // Proxies in front of the API (Render adds one) whose X-Forwarded-For
  // entry is trusted for the client IP used by rate limits.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  // Transactional email (Resend). EMAIL_FROM must use the verified domain.
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  // Shown in emails as the address people can write to.
  SUPPORT_EMAIL: z.email().optional(),
  // The email provider's daily allowance (Resend free plan: 100). Auth
  // emails warn at 80% of it and refuse non-essential sends at 90%.
  EMAIL_DAILY_LIMIT: z.coerce.number().int().min(1).default(100),
  // Protective switch: comma-separated features to pause (signup,
  // quiz_create, upload). Validated here so a typo fails at startup.
  PAUSED_FEATURES: z
    .string()
    .optional()
    .refine((value) =>
      parsePausedFeatures(value).every((item) =>
        (Object.values(PAUSABLE_FEATURE) as string[]).includes(item),
      ),
    ),
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
  if (
    result.data.NODE_ENV === NODE_ENV.PRODUCTION &&
    (!result.data.RESEND_API_KEY || !result.data.EMAIL_FROM)
  ) {
    throw new Error('RESEND_API_KEY and EMAIL_FROM are required in production');
  }
  return result.data;
}
