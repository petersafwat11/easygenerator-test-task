const SAFE_CODE = /^[A-Za-z0-9_.-]{1,64}$/;

export interface SanitizedError {
  type: string;
  code?: string | number;
  stack?: string[];
}

/**
 * Allowlist view of an error for logs: class name, driver/app error code and stack
 * frames. Raw messages are never included because they can carry user data
 * (Mongo's duplicate-key message contains the email, for example).
 *
 * Accepts either an Error or the object pino's std serializer already made from one.
 */
export function sanitizeError(error: unknown): SanitizedError {
  if (typeof error !== 'object' || error === null) {
    return { type: typeof error };
  }
  const { type, code, stack } = error as {
    type?: unknown;
    code?: unknown;
    stack?: unknown;
  };
  const result: SanitizedError = {
    type:
      error instanceof Error
        ? error.constructor?.name || 'Error'
        : typeof type === 'string' && SAFE_CODE.test(type)
          ? type
          : 'Unknown',
  };
  if (
    (typeof code === 'number' && Number.isFinite(code)) ||
    (typeof code === 'string' && SAFE_CODE.test(code))
  ) {
    result.code = code;
  }
  const frames = typeof stack === 'string' ? stackFrames(stack) : [];
  if (frames.length > 0) result.stack = frames;
  return result;
}

/** Keeps only the "at ..." frames; the leading line(s) repeat the message. */
function stackFrames(stack: string): string[] {
  return stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '));
}
