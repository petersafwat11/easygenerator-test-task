import {
  DynamicModule,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_PIPE } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { join } from 'node:path';
import type { DestinationStream, Level } from 'pino';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { buildLoggerParams } from './common/logging/logger.config';
import { JsonOnlyMiddleware } from './common/middleware/json-only.middleware';
import { OriginCheckMiddleware } from './common/middleware/origin-check.middleware';
import { AppThrottlerGuard } from './common/throttling/app-throttler.guard';
import { throttlerOptions } from './common/throttling/throttling';
import { createValidationPipe } from './common/validation/validation.pipe';
import { Env, validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';

export interface AppModuleOptions {
  /** Values applied on top of process.env and .env (tests use this). */
  env?: Record<string, string>;
  ignoreEnvFile?: boolean;
  logStream?: DestinationStream;
  logLevel?: Level;
  /** Built frontend served in production. Defaults to ../frontend/dist next to the backend. */
  staticRoot?: string;
}

const DEFAULT_STATIC_ROOT = join(__dirname, '..', '..', 'frontend', 'dist');

@Module({})
export class AppModule implements NestModule {
  static forRoot(options: AppModuleOptions = {}): DynamicModule {
    return {
      module: AppModule,
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: options.ignoreEnvFile,
          validate: (raw) => validateEnv({ ...raw, ...options.env }),
        }),
        LoggerModule.forRoot(
          buildLoggerParams({
            level: options.logLevel ?? 'info',
            stream: options.logStream,
          }),
        ),
        MongooseModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) => ({
            uri: config.get('MONGODB_URI', { infer: true }),
            // Fail fast (503) instead of hanging when the database is unreachable.
            serverSelectionTimeoutMS: 5000,
            bufferCommands: false,
          }),
        }),
        ThrottlerModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) =>
            throttlerOptions({
              THROTTLE_GLOBAL_LIMIT: config.get('THROTTLE_GLOBAL_LIMIT', {
                infer: true,
              }),
              THROTTLE_AUTH_LIMIT: config.get('THROTTLE_AUTH_LIMIT', {
                infer: true,
              }),
            }),
        }),
        // Production is one origin: the API and the built SPA. Unknown /api/* paths
        // stay JSON 404s instead of falling back to index.html.
        ServeStaticModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService<Env, true>) =>
            config.get('NODE_ENV', { infer: true }) === 'production'
              ? [
                  {
                    rootPath: options.staticRoot ?? DEFAULT_STATIC_ROOT,
                    exclude: ['/api/{*path}'],
                  },
                ]
              : [],
        }),
        HealthModule,
        AuthModule,
      ],
      providers: [
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        // Rate limiting runs before the session guard (registered in AuthModule),
        // so floods are rejected without a session lookup.
        { provide: APP_GUARD, useClass: AppThrottlerGuard },
        { provide: APP_PIPE, useFactory: createValidationPipe },
      ],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(JsonOnlyMiddleware, OriginCheckMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}
