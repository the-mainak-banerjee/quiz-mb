import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { apiError } from '@/lib/api/client';
const NON_FIELD_DETAILS = new Set(['retryAfterSeconds', 'attemptsLeft']);

export function setApiErrors<T extends FieldValues>(
  failure: unknown,
  setError: UseFormSetError<T>,
) {
  const error = apiError(failure);
  // Details that describe the refusal itself are not form fields.
  const fields = Object.entries(error.details).filter(
    ([key]) => !NON_FIELD_DETAILS.has(key),
  );
  if (fields.length)
    for (const [field, message] of fields)
      setError(field as Path<T>, { message });
  else setError('root', { message: error.message });
}
