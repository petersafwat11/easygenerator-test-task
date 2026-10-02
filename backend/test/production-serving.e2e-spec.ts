import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import {
  sessionCookieFrom,
  setCookieHeaders,
  signup,
  uniqueEmail,
  VALID_PASSWORD,
} from './helpers/auth-helpers';
import { createTestApp, startMongo } from './helpers/test-app';

const INDEX_HTML = '<!doctype html><title>SPA</title><div id="root"></div>';

/** NODE_ENV=production: one origin serving the API and the built SPA. */
describe('Production serving (e2e)', () => {
  let mongod: MongoMemoryServer;
  let app: NestExpressApplication;
  let staticRoot: string;

  beforeAll(async () => {
    staticRoot = mkdtempSync(join(tmpdir(), 'spa-'));
    writeFileSync(join(staticRoot, 'index.html'), INDEX_HTML);
    mkdirSync(join(staticRoot, 'assets'));
    writeFileSync(join(staticRoot, 'assets', 'app.js'), 'console.log(1)');

    mongod = await startMongo();
    ({ app } = await createTestApp(
      mongod,
      { NODE_ENV: 'production' },
      { staticRoot },
    ));
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
    rmSync(staticRoot, { recursive: true, force: true });
  });

  const http = () => request(app.getHttpServer());

  it.each(['/', '/app', '/signin', '/some/deep/link'])(
    'serves index.html for SPA route %s',
    async (path) => {
      const res = await http().get(path);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
      expect(res.text).toBe(INDEX_HTML);
    },
  );

  it('serves built assets', async () => {
    const res = await http().get('/assets/app.js');
    expect(res.status).toBe(200);
    expect(res.text).toBe('console.log(1)');
  });

  it.each(['/api/x', '/api/users/nope', '/api'])(
    'keeps unknown API path %s a JSON 404, never index.html',
    async (path) => {
      const res = await http().get(path);
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body).toMatchObject({ code: 'NOT_FOUND' });
    },
  );

  it('still serves the API', async () => {
    await http().get('/api/health/live').expect(200);
  });

  it('uses a Secure, __Host- session cookie', async () => {
    const res = await signup(app, {
      email: uniqueEmail(),
      name: 'Ada',
      password: VALID_PASSWORD,
    }).expect(201);

    const cookie = setCookieHeaders(res).find((c) =>
      c.startsWith('__Host-session='),
    );
    expect(cookie).toMatch(/; Secure/);
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; Path=\//);
    expect(cookie).not.toMatch(/; Domain=/);

    await http()
      .get('/api/users/me')
      .set('Cookie', sessionCookieFrom(res, '__Host-session'))
      .expect(200);
  });
});
