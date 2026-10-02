import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { DestinationStream, Level } from 'pino';
import type { Options } from 'pino-http';
import type { Params } from 'nestjs-pino';
import { sanitizeError } from './sanitize-error';

export const REDACTED_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'res.headers["set-cookie"]',
];

export interface LoggerConfigOptions {
  level: Level;
  stream?: DestinationStream;
}

/**
 * JSON logs with a server-generated request id, redacted credentials and sanitized
 * errors. Request and response bodies are never logged (the std serializers omit them).
 */
export function buildLoggerParams({
  level,
  stream,
}: LoggerConfigOptions): Params {
  const options: Options = {
    level,
    // The id is assigned by the first middleware in createApp(); this is a fallback.
    genReqId: (req: IncomingMessage) =>
      (req as IncomingMessage & { id?: string }).id ?? randomUUID(),
    redact: { paths: REDACTED_PATHS, censor: '[REDACTED]' },
    serializers: { err: sanitizeError },
    customLogLevel: (
      _req: IncomingMessage,
      res: ServerResponse,
      err?: Error,
    ) => {
      if (err || res.statusCode >= 500) return 'error';
      if (res.statusCode >= 400) return 'warn';
      return 'info';
    },
  };
  return { pinoHttp: stream ? [options, stream] : options };
}
