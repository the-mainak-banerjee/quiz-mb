import { ERROR_CODE } from '@quizmb/contracts';
import type { ApiError } from '@/lib/api/client';

/** What a refused code means for the person entering it. */
export function codeProblem(error: ApiError) {
  switch (error.code) {
    case ERROR_CODE.INVALID_CODE: {
      const left = Number(error.details.attemptsLeft);
      return Number.isFinite(left) && left > 0
        ? `That code is incorrect. You have ${left} ${left === 1 ? 'try' : 'tries'} left.`
        : 'That code is incorrect.';
    }
    case ERROR_CODE.CODE_EXPIRED:
      return 'This code has expired or can no longer be used. Request a new code.';
    case ERROR_CODE.VALIDATION_ERROR:
      return 'Enter the 6-digit code.';
    default:
      return error.message;
  }
}
