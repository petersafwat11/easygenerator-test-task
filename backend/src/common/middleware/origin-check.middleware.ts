import { HttpStatus, Injectable, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { NextFunction, Request, Response } from 'express';
import type { Env } from '../../config/env.validation';
import { AppError } from '../errors/app-error';
import { ErrorCode } from '../errors/error-codes';
import { isMutation } from './json-only.middleware';

/** Defense in depth: a mutation that names a foreign Origin is rejected outright. */
@Injectable()
export class OriginCheckMiddleware implements NestMiddleware {
  private readonly allowed: ReadonlySet<string>;

  constructor(config: ConfigService<Env, true>) {
    this.allowed = new Set(config.get('ALLOWED_ORIGINS', { infer: true }));
  }

  use(req: Request, _res: Response, next: NextFunction): void {
    const origin = req.headers.origin;
    if (
      isMutation(req.method) &&
      origin !== undefined &&
      !this.allowed.has(origin)
    ) {
      throw new AppError(HttpStatus.FORBIDDEN, ErrorCode.FORBIDDEN_ORIGIN);
    }
    next();
  }
}
