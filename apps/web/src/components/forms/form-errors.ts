import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { apiError } from '@/lib/api/client';
export function setApiErrors<T extends FieldValues>(
  failure: unknown,
  setError: UseFormSetError<T>,
) {
  const error = apiError(failure);
  if (Object.keys(error.details).length)
    for (const [field, message] of Object.entries(error.details))
      setError(field as Path<T>, { message });
  else setError('root', { message: error.message });
}
