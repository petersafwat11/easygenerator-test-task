export const ErrorCode = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_TAKEN: 'EMAIL_TAKEN',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN_ORIGIN: 'FORBIDDEN_ORIGIN',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  RATE_LIMITED: 'RATE_LIMITED',
  NOT_FOUND: 'NOT_FOUND',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Public message per code. Specific errors may override it, but never with internals. */
export const DEFAULT_MESSAGES: Record<ErrorCode, string> = {
  VALIDATION_ERROR: 'Check the highlighted fields.',
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_TAKEN: 'An account with this email already exists',
  UNAUTHENTICATED: 'You need to sign in.',
  FORBIDDEN_ORIGIN: 'Request origin is not allowed.',
  UNSUPPORTED_MEDIA_TYPE: 'Requests must use Content-Type: application/json.',
  PAYLOAD_TOO_LARGE: 'Request body is too large.',
  RATE_LIMITED: 'Too many requests. Try again later.',
  NOT_FOUND: 'Resource not found.',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Try again shortly.',
  INTERNAL_ERROR: 'Something went wrong. Try again later.',
};
