import Joi from 'joi';

export interface Env {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  MONGODB_URI: string;
  SESSION_TTL_SECONDS: number;
  ALLOWED_ORIGINS: string[];
  TRUST_PROXY_HOPS: number;
  GIT_SHA: string;
  THROTTLE_GLOBAL_LIMIT: number;
  THROTTLE_AUTH_LIMIT: number;
}

/** Vite dev server and the API itself (Swagger "Try it out"). */
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:3000'];

/** Comma-separated origins, each in `scheme://host[:port]` form, at least one. */
function parseOrigins(
  value: string,
  helpers: Joi.CustomHelpers<string[]>,
): string[] | Joi.ErrorReport {
  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  if (origins.length === 0) {
    return helpers.message({
      custom: '{{#label}} must list at least one origin',
    });
  }
  for (const origin of origins) {
    if (!isOrigin(origin)) {
      return helpers.message({
        custom: `{{#label}} contains "${origin}", which is not an origin (expected scheme://host[:port])`,
      });
    }
  }
  return origins;
}

function isOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.origin === value
    );
  } catch {
    return false;
  }
}

export const envSchema = Joi.object<Env>({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .required(),
  SESSION_TTL_SECONDS: Joi.number().integer().min(60).default(28800),
  // Production must name its real origin: a silent localhost default would boot
  // fine and then answer 403 to every sign-in, which is the opposite of fail fast.
  ALLOWED_ORIGINS: Joi.string()
    .custom(parseOrigins)
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.string().default(DEV_ORIGINS),
    }),
  TRUST_PROXY_HOPS: Joi.number().integer().min(0).default(0),
  GIT_SHA: Joi.string().default('dev'),
  THROTTLE_GLOBAL_LIMIT: Joi.number().integer().min(1).default(100),
  THROTTLE_AUTH_LIMIT: Joi.number().integer().min(1).default(10),
});

/** Validates raw env vars; throws on boot so misconfiguration never reaches a request. */
export function validateEnv(raw: Record<string, unknown>): Env {
  const result: Joi.ValidationResult<Env> = envSchema.validate(raw, {
    abortEarly: false,
    allowUnknown: true,
    convert: true,
  });
  if (result.error) {
    throw new Error(`Invalid environment: ${result.error.message}`);
  }
  return result.value;
}
