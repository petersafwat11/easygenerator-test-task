import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Model } from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { Session } from '../src/sessions/schemas/session.schema';
import { SessionsService } from '../src/sessions/sessions.service';
import { User } from '../src/users/schemas/user.schema';
import { PASSWORD_VECTORS } from './fixtures/validation-vectors';
import {
  postJson,
  sessionCookieFrom,
  setCookieHeaders,
  signup,
  uniqueEmail,
  VALID_PASSWORD,
} from './helpers/auth-helpers';
import { createTestApp, startMongo } from './helpers/test-app';

describe('Sessions: signin, /users/me, logout (e2e)', () => {
  let mongod: MongoMemoryServer;
  let app: NestExpressApplication;
  let userModel: Model<User>;
  let sessionModel: Model<Session>;

  beforeAll(async () => {
    mongod = await startMongo();
    ({ app } = await createTestApp(mongod));
    userModel = app.get<Model<User>>(getModelToken(User.name));
    sessionModel = app.get<Model<Session>>(getModelToken(Session.name));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await app.close();
    await mongod.stop();
  });

  const signin = (body: unknown, cookie?: string) =>
    postJson(app, '/api/auth/signin', body, cookie);
  const logout = (cookie?: string) =>
    postJson(app, '/api/auth/logout', {}, cookie);
  const me = (cookie?: string) => {
    const req = request(app.getHttpServer()).get('/api/users/me');
    return cookie ? req.set('Cookie', cookie) : req;
  };

  /** Registers a fresh account and returns its credentials and session cookie. */
  async function registered(password = VALID_PASSWORD) {
    const email = uniqueEmail();
    const res = await signup(app, { email, name: 'Ada', password }).expect(201);
    return { email, password, cookie: sessionCookieFrom(res) };
  }

  describe('POST /api/auth/signin', () => {
    it('signs in with correct credentials and sets a new session cookie', async () => {
      const { email, password, cookie: signupCookie } = await registered();

      const res = await signin({ email, password });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        user: {
          id: expect.any(String) as unknown,
          email,
          name: 'Ada',
          createdAt: expect.any(String) as unknown,
        },
      });
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);
      const cookie = sessionCookieFrom(res);
      expect(cookie).not.toBe(signupCookie);
      await me(cookie).expect(200);
    });

    it('gives the same answer for a wrong password and an unknown email', async () => {
      const { email } = await registered();

      const wrongPassword = await signin({ email, password: 'wrong123!' });
      const unknownEmail = await signin({
        email: uniqueEmail('nobody'),
        password: 'wrong123!',
      });

      for (const res of [wrongPassword, unknownEmail]) {
        expect(res.status).toBe(401);
        expect(setCookieHeaders(res)).toHaveLength(0);
      }
      // Everything but the per-request id must match.
      const withoutRequestId = (body: Record<string, unknown>) =>
        Object.fromEntries(
          Object.entries(body).filter(([key]) => key !== 'requestId'),
        );
      const a = withoutRequestId(wrongPassword.body as Record<string, unknown>);
      const b = withoutRequestId(unknownEmail.body as Record<string, unknown>);
      expect(a).toEqual({
        statusCode: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
      expect(b).toEqual(a);
    });

    it('normalizes the email: signed up as "  User@Mail.com ", signs in as user@mail.com', async () => {
      const local = uniqueEmail('User').split('@')[0];
      await signup(app, {
        email: `  ${local}@Mail.com `,
        name: 'Ada',
        password: VALID_PASSWORD,
      }).expect(201);

      await signin({
        email: `${local.toLowerCase()}@mail.com`,
        password: VALID_PASSWORD,
      }).expect(200);
    });

    it.each(PASSWORD_VECTORS.filter((v) => v.valid))(
      'a signup-valid password always works at signin ($note)',
      async ({ input }) => {
        const { email } = await registered(input);
        await signin({ email, password: input }).expect(200);
      },
    );

    it('is looser than signup: any 1–128 character password is checked, not rejected', async () => {
      const { email } = await registered();
      const res = await signin({ email, password: 'x' });
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ code: 'INVALID_CREDENTIALS' });
    });

    it.each([
      ['an invalid email', { email: 'user@mail', password: 'abc12345!' }],
      ['an empty password', { email: 'a@b.co', password: '' }],
      [
        'a 129-character password',
        { email: 'a@b.co', password: 'a'.repeat(129) },
      ],
      ['an operator object', { email: { $gt: '' }, password: 'abc12345!' }],
      ['an unknown field', { email: 'a@b.co', password: 'x', extra: 1 }],
    ])('rejects %s with 400', async (_label, body) => {
      const res = await signin(body);
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
    });

    it('replaces the session the request arrived with', async () => {
      const { email, password, cookie: oldCookie } = await registered();

      const res = await signin({ email, password }, oldCookie);

      expect(res.status).toBe(200);
      const newCookie = sessionCookieFrom(res);
      await me(oldCookie).expect(401);
      await me(newCookie).expect(200);
    });

    it('keeps the existing login when the replacement session cannot be saved', async () => {
      const { email, password, cookie } = await registered();
      jest
        .spyOn(app.get(SessionsService), 'create')
        .mockRejectedValueOnce(new Error('insert failed'));

      const res = await signin({ email, password }, cookie);

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
      expect(setCookieHeaders(res)).toHaveLength(0);
      await me(cookie).expect(200);
    });

    it('works after a signup whose session insert failed', async () => {
      jest
        .spyOn(app.get(SessionsService), 'create')
        .mockRejectedValueOnce(new Error('insert failed'));
      const email = uniqueEmail();
      const res = await signup(app, {
        email,
        name: 'Ada',
        password: VALID_PASSWORD,
      });
      expect(res.body).toMatchObject({ authenticated: false });

      await signin({ email, password: VALID_PASSWORD }).expect(200);
    });
  });

  describe('GET /api/users/me', () => {
    it('returns the signed-in user', async () => {
      const { email, cookie } = await registered();
      const res = await me(cookie);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        user: {
          id: expect.any(String) as unknown,
          email,
          name: 'Ada',
          createdAt: expect.any(String) as unknown,
        },
      });
    });

    it('is 401 without a cookie', async () => {
      const res = await me();
      expect(res.status).toBe(401);
      expect(res.body).toMatchObject({ code: 'UNAUTHENTICATED' });
    });

    it.each([
      'session=short',
      'session=' + 'a'.repeat(44),
      'session=' + '!'.repeat(43),
      'other=' + 'a'.repeat(43),
    ])(
      'is 401 for a malformed cookie (%s) without querying the DB',
      async (cookie) => {
        const findValid = jest.spyOn(app.get(SessionsService), 'findValid');
        await me(cookie).expect(401);
        expect(findValid).not.toHaveBeenCalled();
      },
    );

    it('is 401 for a well-formed but unknown token', async () => {
      await me('session=' + 'A'.repeat(43)).expect(401);
    });

    it('is 401 once the session has expired, even if the record still exists', async () => {
      const { cookie } = await registered();
      const token = cookie.split('=')[1];
      await sessionModel.updateOne(
        { tokenHash: SessionsService.hashToken(token) },
        { $set: { expiresAt: new Date(Date.now() - 1000) } },
      );
      expect(
        await sessionModel.countDocuments({
          tokenHash: SessionsService.hashToken(token),
        }),
      ).toBe(1);

      await me(cookie).expect(401);
    });

    it('is 401 when the session outlives its user', async () => {
      const { email, cookie } = await registered();
      await userModel.deleteOne({ email });
      await me(cookie).expect(401);
    });

    it('does not extend the session when used', async () => {
      const { cookie } = await registered();
      const tokenHash = SessionsService.hashToken(cookie.split('=')[1]);
      const before = await sessionModel.findOne({ tokenHash }).lean().exec();
      await me(cookie).expect(200);
      const after = await sessionModel.findOne({ tokenHash }).lean().exec();
      expect(after?.expiresAt).toEqual(before?.expiresAt);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('deletes the server session and clears the cookie; replaying it is 401', async () => {
      const { cookie } = await registered();
      const tokenHash = SessionsService.hashToken(cookie.split('=')[1]);

      const res = await logout(cookie);

      expect(res.status).toBe(204);
      expect(res.text).toBe('');
      const cleared = setCookieHeaders(res).find((c) =>
        c.startsWith('session='),
      );
      expect(cleared).toMatch(/^session=;/);
      expect(cleared).toMatch(/Expires=Thu, 01 Jan 1970/);
      expect(cleared).toMatch(/; Path=\//);
      expect(await sessionModel.countDocuments({ tokenHash })).toBe(0);

      // Replay: the copied cookie no longer works anywhere.
      await me(cookie).expect(401);
    });

    it('ends only the current session; other sessions of the same user stay valid', async () => {
      const { email, password, cookie: first } = await registered();
      const second = sessionCookieFrom(
        await signin({ email, password }).expect(200),
      );

      await logout(first).expect(204);

      await me(first).expect(401);
      await me(second).expect(200);
    });

    it('is idempotent: logging out twice, or without a cookie, is 204', async () => {
      const { cookie } = await registered();
      await logout(cookie).expect(204);
      await logout(cookie).expect(204);
      await logout().expect(204);
      await logout('session=garbage').expect(204);
    });

    it('still requires a JSON body (415 otherwise)', async () => {
      const res = await request(app.getHttpServer()).post('/api/auth/logout');
      expect(res.status).toBe(415);
    });

    it('answers 503 and keeps the cookie when the session cannot be deleted', async () => {
      const { cookie } = await registered();
      jest
        .spyOn(app.get(SessionsService), 'deleteByToken')
        .mockRejectedValueOnce(new Error('delete failed'));

      const res = await logout(cookie);

      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ code: 'SERVICE_UNAVAILABLE' });
      expect(setCookieHeaders(res)).toHaveLength(0);
      await me(cookie).expect(200);
    });
  });

  describe('Cache-Control', () => {
    it('marks auth and /me responses no-store, including errors', async () => {
      const { email, password, cookie } = await registered();
      const responses = [
        await signin({ email, password }),
        await signin({ email, password: 'wrong123!' }),
        await signup(app, { email, name: 'Ada', password }),
        await me(cookie),
        await me(),
        await logout(cookie),
      ];
      for (const res of responses) {
        expect(res.headers['cache-control']).toBe('no-store');
      }
    });
  });
});
