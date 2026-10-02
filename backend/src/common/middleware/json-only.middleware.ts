import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function isMutation(method: string): boolean {
  return MUTATING_METHODS.has(method.toUpperCase());
}

/**
 * Every mutation must be JSON. A cross-site form or `no-cors` fetch cannot send
 * `application/json` without a CORS preflight, which this API never grants, so
 * this is the main CSRF barrier.
 */
@Injectable()
export class JsonOnlyMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    if (
      isMutation(req.method) &&
      !isJsonContentType(req.headers['content-type'])
    ) {
      throw new AppError(
        HttpStatus.UNSUPPORTED_MEDIA_TYPE,
        ErrorCode.UNSUPPORTED_MEDIA_TYPE,
      );
    }
    next();
  }
}

function isJsonContentType(header: string | undefined): boolean {
  const mediaType = header?.split(';')[0]?.trim().toLowerCase();
  return mediaType === 'application/json';
}
