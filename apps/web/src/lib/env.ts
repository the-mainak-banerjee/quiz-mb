import { z } from 'zod';

export const webEnv = z
  .object({
    NEXT_PUBLIC_API_URL: z
      .url()
      .refine(
        (value) =>
          URL.canParse(value) &&
          ['http:', 'https:'].includes(new URL(value).protocol),
      )
      .default('http://localhost:4000'),
  })
  .parse({ NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL });
