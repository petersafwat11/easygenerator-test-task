import type { NestExpressApplication } from '@nestjs/platform-express';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import {
  postJson,
  sessionCookieFrom,
  signup,
  uniqueEmail,
  VALID_PASSWORD,
} from './helpers/auth-helpers';
import { createTestApp, startMongo } from './helpers/test-app';

/**
 * Stops the database under a running app. Each request waits for server
 * selection (5 s) and must fail as 503: an outage is never "signed out".
 */
describe('Database outage (e2e)', () => {
  let mongod: MongoMemoryServer;
  let app: NestExpressApplication;
  let cookie: string;
  const email = uniqueEmail();

  beforeAll(async () => {
    mongod = await startMongo();
    ({ app } = await createTestApp(mongod));
    const res = await signup(app, {
      email,
      name: 'Ada',
      password: VALID_PASSWORD,
    }).expect(201);
    cookie = sessionCookieFrom(res);
    await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', cookie)
      .expect(200);

    await mongod.stop();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/users/me is 503, not 401', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/users/me')
      .set('Cookie', cookie);
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('signin is 503', async () => {
    const res = await postJson(app, '/api/auth/signin', {
      email,
      password: VALID_PASSWORD,
    });
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
  });

  it('logout is 503 and does not clear the cookie', async () => {
    const res = await postJson(app, '/api/auth/logout', {}, cookie);
    expect(res.status).toBe(503);
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('readiness is 503 while liveness stays 200', async () => {
    const ready = await request(app.getHttpServer()).get('/api/health/ready');
    expect(ready.status).toBe(503);
    expect(ready.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
    await request(app.getHttpServer()).get('/api/health/live').expect(200);
  });
});
