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

export const envSchema = Joi.object<Env>({
  NODE_ENV: Joi.string()
    .valid('development', 'test', 'production')
    .default('development'),
  PORT: Joi.number().port().default(3000),
  MONGODB_URI: Joi.string()
    .uri({ scheme: ['mongodb', 'mongodb+srv'] })
    .required(),
  SESSION_TTL_SECONDS: Joi.number().integer().min(60).default(28800),
  ALLOWED_ORIGINS: Joi.string()
    .default('http://localhost:5173')
    .custom((value: string) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
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
