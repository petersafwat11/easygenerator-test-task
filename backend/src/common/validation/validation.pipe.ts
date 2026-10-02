import { HttpStatus, ValidationError, ValidationPipe } from '@nestjs/common';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';

/** Strict DTO validation: unknown fields are rejected and errors use our shape. */
export function createValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    // Report every failing rule per field, not just the first.
    stopAtFirstError: false,
    exceptionFactory: (errors: ValidationError[]) =>
      new AppError(
        HttpStatus.BAD_REQUEST,
        ErrorCode.VALIDATION_ERROR,
        undefined,
        errors.map((error) => ({
          field: error.property,
          // Rules on one field share a message; report it once.
          messages: [...new Set(Object.values(error.constraints ?? {}))],
        })),
      ),
  });
}
