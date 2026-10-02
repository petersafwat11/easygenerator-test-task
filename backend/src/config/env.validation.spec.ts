import { validateEnv } from './env.validation';

const base = { MONGODB_URI: 'mongodb://localhost:27017/test' };

describe('validateEnv', () => {
  it('applies the documented defaults outside production', () => {
    expect(validateEnv(base)).toMatchObject({
      NODE_ENV: 'development',
      PORT: 3000,
      SESSION_TTL_SECONDS: 28800,
      ALLOWED_ORIGINS: ['http://localhost:5173', 'http://localhost:3000'],
      TRUST_PROXY_HOPS: 0,
      GIT_SHA: 'dev',
      THROTTLE_GLOBAL_LIMIT: 100,
      THROTTLE_AUTH_LIMIT: 10,
    });
  });

  it('converts numeric strings and splits the origin list', () => {
    const env = validateEnv({
      ...base,
      PORT: '8080',
      SESSION_TTL_SECONDS: '60',
      ALLOWED_ORIGINS: ' https://app.example.com ,http://localhost:5173, ',
      TRUST_PROXY_HOPS: '1',
    });
    expect(env.PORT).toBe(8080);
    expect(env.SESSION_TTL_SECONDS).toBe(60);
    expect(env.TRUST_PROXY_HOPS).toBe(1);
    expect(env.ALLOWED_ORIGINS).toEqual([
      'https://app.example.com',
      'http://localhost:5173',
    ]);
  });

  it('fails fast in production when ALLOWED_ORIGINS is missing', () => {
    expect(() => validateEnv({ ...base, NODE_ENV: 'production' })).toThrow(
      /ALLOWED_ORIGINS/,
    );
  });

  it('accepts a production configuration that names its origin', () => {
    const env = validateEnv({
      ...base,
      NODE_ENV: 'production',
      ALLOWED_ORIGINS: 'https://app.example.com',
    });
    expect(env.ALLOWED_ORIGINS).toEqual(['https://app.example.com']);
  });

  it.each([
    ['an empty list', ' , '],
    ['a path', 'https://app.example.com/login'],
    ['a trailing slash', 'https://app.example.com/'],
    ['a bare host', 'app.example.com'],
    ['a non-http scheme', 'ftp://app.example.com'],
  ])('rejects %s in ALLOWED_ORIGINS', (_label, value) => {
    expect(() => validateEnv({ ...base, ALLOWED_ORIGINS: value })).toThrow(
      /ALLOWED_ORIGINS/,
    );
  });

  it.each([
    ['a missing MONGODB_URI', {}],
    ['a non-Mongo URI', { MONGODB_URI: 'postgres://localhost/db' }],
    ['an unknown NODE_ENV', { ...base, NODE_ENV: 'staging' }],
    ['a session TTL under a minute', { ...base, SESSION_TTL_SECONDS: '30' }],
    ['a negative proxy hop count', { ...base, TRUST_PROXY_HOPS: '-1' }],
    ['a zero throttle limit', { ...base, THROTTLE_AUTH_LIMIT: '0' }],
  ])('rejects %s', (_label, raw) => {
    expect(() => validateEnv(raw)).toThrow(/Invalid environment/);
  });
});
