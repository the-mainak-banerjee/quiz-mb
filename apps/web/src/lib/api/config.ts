import { z } from 'zod';

const apiOriginSchema = z
  .url()
  .refine(
    (value) =>
      URL.canParse(value) &&
      ['http:', 'https:'].includes(new URL(value).protocol) &&
      new URL(value).origin === value,
    'API origin must be an HTTP(S) origin without a path',
  );

export const API_ORIGIN = apiOriginSchema.parse(
  process.env.NEXT_PUBLIC_API_URL ??
    (process.env.NODE_ENV === 'production'
      ? 'https://api.quizmb.com'
      : 'http://localhost:4000'),
);
