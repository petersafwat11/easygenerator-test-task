import type { Test } from 'supertest';

/**
 * Requests that fail before any handler runs, with the status each must get.
 * Used in the normal and the production (static-serving) configuration, since
 * the latter adds an Express error handler of its own.
 */
export const EARLY_FAILURES: [
  label: string,
  status: number,
  code: string,
  send: (req: Test) => Test,
][] = [
  [
    'malformed JSON',
    400,
    'VALIDATION_ERROR',
    (req) => req.set('Content-Type', 'application/json').send('{"email": '),
  ],
  [
    'a body over 10 kb',
    413,
    'PAYLOAD_TOO_LARGE',
    (req) =>
      req
        .set('Content-Type', 'application/json')
        .send(JSON.stringify({ filler: 'x'.repeat(11 * 1024) })),
  ],
  [
    'a non-JSON body',
    415,
    'UNSUPPORTED_MEDIA_TYPE',
    (req) => req.set('Content-Type', 'text/plain').send('hello'),
  ],
  [
    'a foreign Origin',
    403,
    'FORBIDDEN_ORIGIN',
    (req) =>
      req
        .set('Content-Type', 'application/json')
        .set('Origin', 'https://evil.example')
        .send({}),
  ],
];
