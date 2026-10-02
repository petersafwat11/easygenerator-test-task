import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AppModule, AppModuleOptions } from './app.module';
import type { Env } from './config/env.validation';

export const BODY_LIMIT = '10kb';

/**
 * Builds the fully configured application. Used by main.ts and by every e2e test,
 * so tests exercise exactly the production pipeline.
 */
export async function createApp(
  options: AppModuleOptions = {},
): Promise<NestExpressApplication> {
  const app = await NestFactory.create<NestExpressApplication>(
    AppModule.forRoot(options),
    { bodyParser: false, bufferLogs: true },
  );
  app.useLogger(app.get(Logger));

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  // A hop count, never `true`: only that many proxies are trusted for X-Forwarded-For.
  app.set('trust proxy', config.get('TRUST_PROXY_HOPS', { infer: true }));

  // Runs first so even body-parser failures carry a request id.
  app.use(assignRequestId);
  app.use(helmet());
  app.useBodyParser('json', { limit: BODY_LIMIT });

  app.setGlobalPrefix('api');
  app.enableShutdownHooks();
  return app;
}

function assignRequestId(req: Request, res: Response, next: NextFunction) {
  const id = randomUUID();
  (req as Request & { id: string }).id = id;
  res.setHeader('X-Request-Id', id);
  next();
}
