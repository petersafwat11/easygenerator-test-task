import { randomUUID } from 'node:crypto';
import { Writable } from 'node:stream';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../../src/app.factory';
import type { AppModuleOptions } from '../../src/app.module';

/** Collects every log line the app writes, so tests can assert on redaction. */
export class LogCapture extends Writable {
  private readonly chunks: string[] = [];

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    this.chunks.push(chunk.toString());
    callback();
  }

  clear(): void {
    this.chunks.length = 0;
  }

  get text(): string {
    return this.chunks.join('');
  }

  entries(): Record<string, unknown>[] {
    return this.text
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);
  }
}

export interface TestApp {
  app: NestExpressApplication;
  logs: LogCapture;
}

export const TEST_ORIGIN = 'http://localhost:5173';
export const TEST_GIT_SHA = 'test-sha';

/**
 * nestjs-pino builds one pino-http instance per process (first configuration wins),
 * so every app created in a test file shares this one capture stream.
 */
const logs = new LogCapture();

export function startMongo(): Promise<MongoMemoryServer> {
  return MongoMemoryServer.create();
}

/**
 * The production createApp() against an isolated database. Throttle limits are
 * very high here; the throttling test builds its own app with the real limits.
 */
export async function createTestApp(
  mongod: MongoMemoryServer,
  env: Record<string, string> = {},
  options: Pick<AppModuleOptions, 'staticRoot'> = {},
): Promise<TestApp> {
  const app = await createApp({
    ...options,
    ignoreEnvFile: true,
    logStream: logs,
    env: {
      NODE_ENV: 'test',
      MONGODB_URI: mongod.getUri(`test_${randomUUID().slice(0, 8)}`),
      ALLOWED_ORIGINS: TEST_ORIGIN,
      GIT_SHA: TEST_GIT_SHA,
      SESSION_TTL_SECONDS: '28800',
      TRUST_PROXY_HOPS: '0',
      THROTTLE_GLOBAL_LIMIT: '100000',
      THROTTLE_AUTH_LIMIT: '100000',
      ...env,
    },
  });
  await app.init();
  return { app, logs };
}
