import type { NestExpressApplication } from '@nestjs/platform-express';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import request, { Response } from 'supertest';
import { HealthCheckService } from '@nestjs/terminus';
import {
  createTestApp,
  LogCapture,
  startMongo,
  TEST_GIT_SHA,
  TEST_ORIGIN,
} from './helpers/test-app';

function expectErrorShape(
  res: Response,
  statusCode: number,
  code: string,
): void {
  expect(res.status).toBe(statusCode);
  expect(res.headers['content-type']).toMatch(/application\/json/);
  const body = res.body as Record<string, unknown>;
  expect(body).toMatchObject({ statusCode, code });
  expect(typeof body.message).toBe('string');
  expect(body.requestId).toBe(res.headers['x-request-id']);
  expect(body.requestId).toMatch(/^[0-9a-f-]{36}$/);
  expect(body).not.toHaveProperty('stack');
}

describe('HTTP policy (e2e)', () => {
  let mongod: MongoMemoryServer;
  let app: NestExpressApplication;

  beforeAll(async () => {
    mongod = await startMongo();
    ({ app } = await createTestApp(mongod));
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  const http = () => request(app.getHttpServer());

  it('rejects a mutation that is not JSON with 415', async () => {
    const res = await http()
      .post('/api/anything')
      .set('Content-Type', 'text/plain')
      .send('hello');
    expectErrorShape(res, 415, 'UNSUPPORTED_MEDIA_TYPE');
  });

  it('rejects a mutation without a Content-Type with 415', async () => {
    const res = await http().post('/api/anything');
    expectErrorShape(res, 415, 'UNSUPPORTED_MEDIA_TYPE');
  });

  it('accepts application/json with a charset parameter', async () => {
    const res = await http()
      .post('/api/anything')
      .set('Content-Type', 'application/json; charset=utf-8')
      .send('{}');
    expectErrorShape(res, 404, 'NOT_FOUND');
  });

  it('rejects a body over 10 kb with 413', async () => {
    const res = await http()
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ filler: 'x'.repeat(11 * 1024) }));
    expectErrorShape(res, 413, 'PAYLOAD_TOO_LARGE');
  });

  it('rejects malformed JSON with 400 in our shape', async () => {
    const res = await http()
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .send('{"email": ');
    expectErrorShape(res, 400, 'VALIDATION_ERROR');
    expect(res.body).not.toHaveProperty('details');
  });

  it('rejects a mutation from a foreign Origin with 403', async () => {
    const res = await http()
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .set('Origin', 'https://evil.example')
      .send({});
    expectErrorShape(res, 403, 'FORBIDDEN_ORIGIN');
  });

  it('lets a mutation from the allowed Origin through the policy', async () => {
    const res = await http()
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .set('Origin', TEST_ORIGIN)
      .send({});
    expectErrorShape(res, 404, 'NOT_FOUND');
  });

  it('does not apply the Origin check to safe methods', async () => {
    const res = await http()
      .get('/api/health/live')
      .set('Origin', 'https://evil.example');
    expect(res.status).toBe(200);
  });

  it('returns a JSON 404 for an unknown /api route', async () => {
    const res = await http().get('/api/x');
    expectErrorShape(res, 404, 'NOT_FOUND');
  });

  it('reports liveness with the deployed commit', async () => {
    const res = await http().get('/api/health/live');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', version: TEST_GIT_SHA });
  });

  it('reports readiness when the database answers', async () => {
    const res = await http().get('/api/health/ready');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok' });
  });

  it('sets security headers (Helmet)', async () => {
    const res = await http().get('/api/health/live');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers).not.toHaveProperty('x-powered-by');
  });
});

describe('Log redaction (e2e)', () => {
  const ERROR_MARKER = 'ERRMSG-MARKER-7f3a';
  const COOKIE_MARKER = 'COOKIE-MARKER-91bc';
  const AUTH_MARKER = 'AUTH-MARKER-55de';
  const PASSWORD_MARKER = 'PASSWORD-MARKER-0c4e';

  let mongod: MongoMemoryServer;
  let app: NestExpressApplication;
  let logs: LogCapture;

  beforeAll(async () => {
    mongod = await startMongo();
    ({ app, logs } = await createTestApp(mongod));
    // An unexpected failure deep inside a request, whose message carries user data.
    jest
      .spyOn(app.get(HealthCheckService), 'check')
      .mockRejectedValue(
        new Error(`boom for user@example.com ${ERROR_MARKER}`),
      );
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
    await mongod.stop();
  });

  it('returns a generic 500 and never logs the error message', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/health/ready')
      .set('Cookie', `session=${COOKIE_MARKER}`)
      .set('Authorization', `Bearer ${AUTH_MARKER}`);

    expectErrorShape(res, 500, 'INTERNAL_ERROR');
    expect(JSON.stringify(res.body)).not.toContain(ERROR_MARKER);

    const text = logs.text;
    expect(text).not.toContain(ERROR_MARKER);
    expect(text).not.toContain('user@example.com');
    expect(text).not.toContain(COOKIE_MARKER);
    expect(text).not.toContain(AUTH_MARKER);

    // The failure is still diagnosable: request id, error class and stack frames.
    const failure = logs
      .entries()
      .find((entry) => entry.msg === 'Request failed');
    expect(failure).toMatchObject({
      requestId: (res.body as { requestId: string }).requestId,
      code: 'INTERNAL_ERROR',
      err: { type: 'Error' },
    });
    expect((failure?.err as { stack: string[] }).stack.length).toBeGreaterThan(
      0,
    );
  });

  it('never logs request bodies', async () => {
    await request(app.getHttpServer())
      .post('/api/anything')
      .set('Content-Type', 'application/json')
      .send({ password: PASSWORD_MARKER });
    expect(logs.text).not.toContain(PASSWORD_MARKER);
  });
});
