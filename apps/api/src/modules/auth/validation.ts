import { z } from 'zod';
import { ApiError } from '../../http/api-error.js';
import { ERROR_CODE } from '@quizmb/contracts';
const email = z
  .string()
  .trim()
  .pipe(z.email().max(254))
  .transform((value) => value.toLowerCase());
const name = z.string().trim().min(1).max(100);
export const signupSchema = z
  .object({
    name,
    email,
    password: z
      .string()
      .refine(
        (p) => Array.from(p).length >= 15 && Array.from(p).length <= 128,
        'Use 15–128 characters.',
      ),
  })
  .strict();
export const loginSchema = z
  .object({ email, password: z.string().min(1).max(1024) })
  .strict();
export { profileSchema } from '@quizmb/contracts';
export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  throw new ApiError(
    422,
    ERROR_CODE.VALIDATION_ERROR,
    'Please check the highlighted fields.',
    Object.fromEntries(
      result.error.issues.map((i) => [i.path.join('.') || 'form', i.message]),
    ),
  );
}
