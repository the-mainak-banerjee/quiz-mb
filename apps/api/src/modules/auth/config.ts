import { z } from 'zod';
export function parseAuthEnv(input: NodeJS.ProcessEnv) {
  const result = z
    .object({
      DATABASE_URL: z.string().url(),
      DATABASE_SSL_CA_BASE64: z.string().min(1).optional(),
      AUTH_COOKIE_DOMAIN: z
        .string()
        .regex(/^(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9-]+$/)
        .optional(),
      AUTH_ACCESS_SECRET: z
        .string()
        .min(43)
        .refine((value) => !value.startsWith('REPLACE_')),
      AUTH_ACCESS_TTL_SECONDS: z.coerce
        .number()
        .int()
        .min(60)
        .max(3600)
        .default(900),
      AUTH_SESSION_TTL_SECONDS: z.coerce
        .number()
        .int()
        .min(3600)
        .max(7776000)
        .default(2592000),
    })
    .safeParse(input);
  if (!result.success)
    throw new Error(
      'Invalid auth environment: ' +
        [...new Set(result.error.issues.map((i) => i.path[0]))].join(', '),
    );
  if (input.NODE_ENV === 'production' && !result.data.AUTH_COOKIE_DOMAIN)
    throw new Error('AUTH_COOKIE_DOMAIN is required in production');
  return result.data;
}
export type AuthConfig = ReturnType<typeof parseAuthEnv>;
