import { randomUUID } from 'node:crypto';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request, { Response } from 'supertest';

export const VALID_PASSWORD = 'abc12345!';

export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}-${randomUUID().slice(0, 8)}@example.com`;
}

export function postJson(
  app: NestExpressApplication,
  path: string,
  body: unknown,
  cookie?: string,
) {
  const req = request(app.getHttpServer())
    .post(path)
    .set('Content-Type', 'application/json');
  if (cookie) req.set('Cookie', cookie);
  return req.send(JSON.stringify(body));
}

export function signup(
  app: NestExpressApplication,
  body: Partial<Record<'email' | 'name' | 'password', unknown>> &
    Record<string, unknown>,
  cookie?: string,
) {
  return postJson(app, '/api/auth/signup', body, cookie);
}

export function setCookieHeaders(res: Response): string[] {
  const header = res.headers['set-cookie'] as string[] | string | undefined;
  if (!header) return [];
  return Array.isArray(header) ? header : [header];
}

/** The `name=value` pair of the session cookie set by a response, ready to send back. */
export function sessionCookieFrom(res: Response, name = 'session'): string {
  const cookie = setCookieHeaders(res).find((c) => c.startsWith(`${name}=`));
  if (!cookie) throw new Error(`No ${name} cookie was set`);
  return cookie.split(';')[0];
}
