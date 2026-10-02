import { HttpException, HttpStatus } from '@nestjs/common';
import { DEFAULT_MESSAGES, ErrorCode } from './error-codes';

export interface FieldErrorDetail {
  field: string;
  messages: string[];
}

/** A deliberate, client-facing error. Its message is always safe to return. */
export class AppError extends HttpException {
  constructor(
    status: HttpStatus,
    readonly code: ErrorCode,
    message: string = DEFAULT_MESSAGES[code],
    readonly details?: FieldErrorDetail[],
  ) {
    super({ code, message, details }, status);
  }

  static unauthenticated(): AppError {
    return new AppError(HttpStatus.UNAUTHORIZED, ErrorCode.UNAUTHENTICATED);
  }

  static serviceUnavailable(): AppError {
    return new AppError(
      HttpStatus.SERVICE_UNAVAILABLE,
      ErrorCode.SERVICE_UNAVAILABLE,
    );
  }
}
