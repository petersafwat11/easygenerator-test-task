import type { NestExpressApplication } from '@nestjs/platform-express';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createTestApp, startMongo } from './helpers/test-app';

interface OpenApiDocument {
  paths: Record<string, Record<string, { security?: unknown[] }>>;
  components: {
    securitySchemes: Record<string, unknown>;
    schemas: Record<string, unknown>;
  };
}

describe('API docs (e2e)', () => {
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await startMongo();
  });

  afterAll(async () => {
    await mongod.stop();
  });

  describe('outside production', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      ({ app } = await createTestApp(mongod));
    });

    afterAll(async () => {
      await app.close();
    });

    it('serves Swagger UI at /api/docs', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toContain('swagger-ui');
    });

    it('documents every endpoint, the DTO schemas and cookie auth', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs-json');
      expect(res.status).toBe(200);
      const doc = res.body as OpenApiDocument;

      expect(Object.keys(doc.paths).sort()).toEqual([
        '/api/auth/logout',
        '/api/auth/signin',
        '/api/auth/signup',
        '/api/health/live',
        '/api/health/ready',
        '/api/users/me',
      ]);
      expect(doc.components.securitySchemes.session).toMatchObject({
        type: 'apiKey',
        in: 'cookie',
        name: 'session',
      });
      expect(doc.paths['/api/users/me'].get.security).toEqual([
        { session: [] },
      ]);
      expect(Object.keys(doc.components.schemas)).toEqual(
        expect.arrayContaining([
          'SignupDto',
          'SigninDto',
          'UserResponseDto',
          'ErrorResponseDto',
        ]),
      );
    });
  });

  describe('in production', () => {
    let app: NestExpressApplication;

    beforeAll(async () => {
      ({ app } = await createTestApp(mongod, { NODE_ENV: 'production' }));
    });

    afterAll(async () => {
      await app.close();
    });

    it('is disabled', async () => {
      const res = await request(app.getHttpServer()).get('/api/docs');
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
    });
  });
});
