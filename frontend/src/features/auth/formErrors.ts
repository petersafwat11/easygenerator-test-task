import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { ApiError, NetworkError } from '../../lib/api'

/**
 * Puts server validation messages on the fields this form owns. Unknown fields
 * are ignored here; the caller shows a general message instead.
 * Returns true if at least one field error was set.
 */
export function applyServerFieldErrors<T extends FieldValues>(
  error: unknown,
  fields: readonly Path<T>[],
  setError: UseFormSetError<T>,
): boolean {
  if (!(error instanceof ApiError)) return false
  let applied = false
  for (const detail of error.details) {
    const field = fields.find((f) => f === detail.field)
    if (!field || detail.messages.length === 0) continue
    setError(
      field,
      { type: 'server', message: detail.messages.join(' ') },
      { shouldFocus: !applied },
    )
    applied = true
  }
  return applied
}

/** A user-facing sentence for errors that don't belong to one field. */
export function describeError(error: unknown): string {
  if (error instanceof NetworkError) return error.message
  if (error instanceof ApiError) {
    if (error.isServerError) {
      return 'The service is temporarily unavailable. Please try again.'
    }
    return error.message
  }
  return 'Something went wrong. Please try again.'
}
