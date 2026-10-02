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
import { LoggerModule } from 'nestjs-pino';
import type { DestinationStream, Level } from 'pino';
import { AuthModule } from './auth/auth.module';
import { SessionGuard } from './auth/session.guard';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { buildLoggerParams } from './common/logging/logger.config';
import { JsonOnlyMiddleware } from './common/middleware/json-only.middleware';
import { OriginCheckMiddleware } from './common/middleware/origin-check.middleware';
import { createValidationPipe } from './common/validation/validation.pipe';
import { Env, validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';

export interface AppModuleOptions {
  /** Values applied on top of process.env and .env (tests use this). */
  env?: Record<string, string>;
  ignoreEnvFile?: boolean;
  logStream?: DestinationStream;
  logLevel?: Level;
}

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
        HealthModule,
        AuthModule,
      ],
      providers: [
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
        { provide: APP_GUARD, useClass: SessionGuard },
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
