import type { NestExpressApplication } from '@nestjs/platform-express';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { postJson } from './helpers/auth-helpers';
import { createTestApp, startMongo } from './helpers/test-app';

/** Built with the real production limits (100/min global, 10/min on credentials). */
const REAL_LIMITS = { THROTTLE_GLOBAL_LIMIT: '100', THROTTLE_AUTH_LIMIT: '10' };

describe('Rate limiting (e2e)', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await startMongo();
  });

  afterAll(async () => {
    await mongod.stop();
  });

  describe('credential endpoints', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      ({ app } = await createTestApp(mongod, REAL_LIMITS));
    });

    afterAll(async () => {
      await app.close();
    });

    it('allows 10 signin attempts per minute, then 429 with Retry-After', async () => {
      const attempt = () =>
        postJson(app, '/api/auth/signin', {
          email: 'nobody@example.com',
          password: 'wrong123!',
        });

      for (let i = 0; i < 10; i++) {
        await attempt().expect(401);
      }
      const res = await attempt();

      expect(res.status).toBe(429);
      expect(res.body).toMatchObject({
        statusCode: 429,
        code: 'RATE_LIMITED',
      });
      const retryAfter = Number(res.headers['retry-after']);
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(60);
    });

    it('limits signup the same way', async () => {
      const attempt = () => postJson(app, '/api/auth/signup', {});
      for (let i = 0; i < 10; i++) {
        await attempt().expect(400);
      }
      const res = await attempt();
      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBeDefined();
    });

    it('does not apply the credential limit to other routes', async () => {
      // Signin is exhausted above; logout is only under the global limit.
      await postJson(app, '/api/auth/logout', {}).expect(204);
    });
  });

  describe('global limit', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      ({ app } = await createTestApp(mongod, REAL_LIMITS));
    });

    afterAll(async () => {
      await app.close();
    });

    it('allows 100 requests per minute on any route, then 429 before authentication runs', async () => {
      for (let i = 0; i < 100; i++) {
        await request(app.getHttpServer()).get('/api/users/me').expect(401);
      }
      // 429, not 401: throttling runs before the session guard.
      const res = await request(app.getHttpServer()).get('/api/users/me');
      expect(res.status).toBe(429);
      expect(res.body).toMatchObject({ code: 'RATE_LIMITED' });
      expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    });
  });
});
