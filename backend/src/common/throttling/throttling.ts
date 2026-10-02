import { ExecutionContext, SetMetadata } from '@nestjs/common';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { Env } from '../../config/env.validation';

const AUTH_THROTTLED = 'authThrottled';
const ONE_MINUTE_MS = 60_000;

/** Marks credential endpoints (signup, signin) for the stricter per-IP limit. */
export const AuthThrottle = () => SetMetadata(AUTH_THROTTLED, true);

function isAuthThrottled(context: ExecutionContext): boolean {
  return (
    Reflect.getMetadata(AUTH_THROTTLED, context.getHandler()) === true ||
    Reflect.getMetadata(AUTH_THROTTLED, context.getClass()) === true
  );
}

/**
 * In-memory buckets per IP and handler: each handler has a `global` bucket,
 * and credential handlers also have an `auth` bucket. Limits come from env so
 * tests can raise them; a single instance makes in-memory storage sufficient.
 */
export function throttlerOptions(
  env: Pick<Env, 'THROTTLE_GLOBAL_LIMIT' | 'THROTTLE_AUTH_LIMIT'>,
): ThrottlerModuleOptions {
  return {
    setHeaders: false,
    throttlers: [
      { name: 'global', ttl: ONE_MINUTE_MS, limit: env.THROTTLE_GLOBAL_LIMIT },
      {
        name: 'auth',
        ttl: ONE_MINUTE_MS,
        limit: env.THROTTLE_AUTH_LIMIT,
        skipIf: (context) => !isAuthThrottled(context),
      },
    ],
  };
}
