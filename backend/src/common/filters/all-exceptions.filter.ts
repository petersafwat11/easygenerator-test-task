import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AppError, FieldErrorDetail } from '../errors/app-error';
import { isDbConnectivityError } from '../errors/db-errors';
import { DEFAULT_MESSAGES, ErrorCode } from '../errors/error-codes';

export interface ErrorResponseBody {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: FieldErrorDetail[];
  requestId: string;
}

interface Classified {
  statusCode: number;
  code: ErrorCode;
  message: string;
  details?: FieldErrorDetail[];
}

const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: ErrorCode.VALIDATION_ERROR,
  [HttpStatus.UNAUTHORIZED]: ErrorCode.UNAUTHENTICATED,
  [HttpStatus.FORBIDDEN]: ErrorCode.FORBIDDEN_ORIGIN,
  [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
  [HttpStatus.PAYLOAD_TOO_LARGE]: ErrorCode.PAYLOAD_TOO_LARGE,
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
  [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMITED,
  [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
};

/**
 * Turns every exception into the one public error shape. Unknown errors become a
 * generic 500; their detail reaches the logs only through the sanitizing serializer.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @InjectPinoLogger(AllExceptionsFilter.name)
    private readonly logger: PinoLogger,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request & { id?: unknown }>();
    const res = http.getResponse<Response>();
    const classified = classify(exception);
    const requestId = typeof req.id === 'string' ? req.id : '';

    if (classified.statusCode >= 500) {
      const level = classified.statusCode === 503 ? 'warn' : ('error' as const);
      this.logger[level](
        { err: exception, code: classified.code, requestId },
        'Request failed',
      );
    }

    sendErrorResponse(res, classified, requestId);
  }
}

/**
 * Express-level handler for errors raised before Nest's pipeline, i.e. by the
 * body parser (malformed JSON → 400, oversized → 413). Registered right after
 * the parser so it answers first: in production the static-file module adds
 * its own error handler that would turn any error on an /api path into a 404.
 */
export function bodyParserErrorHandler(
  err: unknown,
  req: Request & { id?: unknown },
  res: Response,
  next: NextFunction,
): void {
  if (bodyParserErrorStatus(err) === undefined) {
    next(err);
    return;
  }
  sendErrorResponse(
    res,
    classify(err),
    typeof req.id === 'string' ? req.id : '',
  );
}

function sendErrorResponse(
  res: Response,
  classified: Classified,
  requestId: string,
): void {
  if (res.headersSent) return;
  const body: ErrorResponseBody = {
    statusCode: classified.statusCode,
    code: classified.code,
    message: classified.message,
    ...(classified.details ? { details: classified.details } : {}),
    requestId,
  };
  res.status(classified.statusCode).json(body);
}

export function classify(exception: unknown): Classified {
  if (exception instanceof AppError) {
    const response = exception.getResponse() as { message: string };
    return {
      statusCode: exception.getStatus(),
      code: exception.code,
      message: response.message,
      details: exception.details,
    };
  }

  if (exception instanceof HttpException) {
    return fromStatus(exception.getStatus());
  }

  const bodyParserStatus = bodyParserErrorStatus(exception);
  if (bodyParserStatus !== undefined) {
    if (bodyParserStatus === 400) {
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Request body is not valid JSON.',
      };
    }
    return fromStatus(bodyParserStatus);
  }

  if (isDbConnectivityError(exception)) {
    return fromStatus(HttpStatus.SERVICE_UNAVAILABLE);
  }

  return fromStatus(HttpStatus.INTERNAL_SERVER_ERROR);
}

function fromStatus(statusCode: number): Classified {
  const code =
    CODE_BY_STATUS[statusCode] ??
    (statusCode >= 500 ? ErrorCode.INTERNAL_ERROR : ErrorCode.VALIDATION_ERROR);
  const message =
    code === ErrorCode.VALIDATION_ERROR
      ? 'Invalid request.'
      : DEFAULT_MESSAGES[code];
  // Unmapped 5xx statuses are reported as a plain 500.
  const status =
    statusCode >= 500 && code === ErrorCode.INTERNAL_ERROR ? 500 : statusCode;
  return { statusCode: status, code, message };
}

/** body-parser errors carry `type` ("entity.parse.failed", ...) and a 4xx `status`. */
function bodyParserErrorStatus(exception: unknown): number | undefined {
  if (typeof exception !== 'object' || exception === null) return undefined;
  const { type, status } = exception as { type?: unknown; status?: unknown };
  if (
    typeof type === 'string' &&
    typeof status === 'number' &&
    status >= 400 &&
    status < 500
  ) {
    return status;
  }
  return undefined;
}
