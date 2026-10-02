import { getModelToken } from '@nestjs/mongoose';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Model } from 'mongoose';
import type { MongoMemoryServer } from 'mongodb-memory-server';
import { Session } from '../src/sessions/schemas/session.schema';
import { SessionsService } from '../src/sessions/sessions.service';
import { User } from '../src/users/schemas/user.schema';
import { UsersService } from '../src/users/users.service';
import {
  EMAIL_VECTORS,
  NAME_VECTORS,
  PASSWORD_VECTORS,
} from './fixtures/validation-vectors';
import {
  sessionCookieFrom,
  setCookieHeaders,
  signup,
  uniqueEmail,
  VALID_PASSWORD,
} from './helpers/auth-helpers';
import { createTestApp, LogCapture, startMongo } from './helpers/test-app';

describe('POST /api/auth/signup (e2e)', () => {
  let mongod: MongoMemoryServer;
  let app: NestExpressApplication;
  let logs: LogCapture;
  let userModel: Model<User>;
  let sessionModel: Model<Session>;

  beforeAll(async () => {
    mongod = await startMongo();
    ({ app, logs } = await createTestApp(mongod));
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

  const validBody = (overrides: Record<string, unknown> = {}) => ({
    email: uniqueEmail(),
    name: 'Ada Lovelace',
    password: VALID_PASSWORD,
    ...overrides,
  });

  describe('success', () => {
    it('creates the user and a session, and sets the session cookie', async () => {
      const body = validBody();
      const res = await signup(app, body);

      expect(res.status).toBe(201);
      expect(res.body).toEqual({
        user: {
          id: expect.stringMatching(/^[0-9a-f]{24}$/) as unknown,
          email: body.email,
          name: 'Ada Lovelace',
          createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) as unknown,
        },
        authenticated: true,
      });
      expect(JSON.stringify(res.body)).not.toMatch(/password/i);

      const cookie = setCookieHeaders(res).find((c) =>
        c.startsWith('session='),
      );
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/^session=[A-Za-z0-9_-]{43};/);
      expect(cookie).toMatch(/; Max-Age=28800;/);
      expect(cookie).toMatch(/; Path=\//);
      expect(cookie).toMatch(/; HttpOnly/);
      expect(cookie).toMatch(/; SameSite=Lax/);
      expect(cookie).not.toMatch(/; Domain=/);
      // Development/test cookie is not Secure; production is covered by a unit test.
      expect(cookie).not.toMatch(/; Secure/);
    });

    it('stores an argon2id hash with the OWASP parameters, never the password', async () => {
      const body = validBody();
      await signup(app, body).expect(201);

      const stored = await userModel
        .findOne({ email: body.email })
        .select('+passwordHash')
        .lean()
        .exec();
      expect(stored?.passwordHash).toMatch(
        /^\$argon2id\$v=19\$m=19456,p=1,t=2\$/,
      );
      expect(stored?.passwordHash).not.toContain(VALID_PASSWORD);
    });

    it('stores only the SHA-256 hash of the session token', async () => {
      const res = await signup(app, validBody()).expect(201);
      const token = sessionCookieFrom(res).split('=')[1];

      const session = await sessionModel
        .findOne({ tokenHash: SessionsService.hashToken(token) })
        .lean()
        .exec();
      expect(session).not.toBeNull();
      expect(await sessionModel.countDocuments({ tokenHash: token })).toBe(0);
      const ttlMs = session!.expiresAt.getTime() - session!.createdAt.getTime();
      expect(Math.abs(ttlMs - 28800 * 1000)).toBeLessThan(5000);
    });

    it('normalizes the email (trim + lowercase) before storing', async () => {
      const local = uniqueEmail('Mixed.Case').split('@')[0];
      const res = await signup(
        app,
        validBody({ email: `  ${local}@Example.COM ` }),
      );
      expect(res.status).toBe(201);
      expect((res.body as { user: { email: string } }).user.email).toBe(
        `${local.toLowerCase()}@example.com`,
      );
    });

    it('trims the name but never the password', async () => {
      const body = validBody({ name: '  Grace  ', password: ' abc12345! ' });
      const res = await signup(app, body).expect(201);
      expect((res.body as { user: { name: string } }).user.name).toBe('Grace');

      const stored = await userModel
        .findOne({ email: body.email })
        .select('+passwordHash')
        .lean()
        .exec();
      const argon2 = await import('argon2');
      expect(await argon2.verify(stored!.passwordHash, ' abc12345! ')).toBe(
        true,
      );
      expect(await argon2.verify(stored!.passwordHash, 'abc12345!')).toBe(
        false,
      );
    });

    it('does not log the Set-Cookie value', async () => {
      const res = await signup(app, validBody()).expect(201);
      const token = sessionCookieFrom(res).split('=')[1];
      expect(logs.text).not.toContain(token);
    });
  });

  describe('partial failure', () => {
    it('reports an account without a session honestly when the session insert fails', async () => {
      jest
        .spyOn(app.get(SessionsService), 'create')
        .mockRejectedValueOnce(new Error('session insert failed'));
      const body = validBody();

      const res = await signup(app, body);

      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        user: { email: body.email },
        authenticated: false,
      });
      expect(setCookieHeaders(res)).toHaveLength(0);
      expect(await userModel.countDocuments({ email: body.email })).toBe(1);
      expect(logs.text).not.toContain('session insert failed');
      // A retry is correctly told the account exists.
      await signup(app, body).expect(409);
    });
  });

  describe('validation', () => {
    it.each(PASSWORD_VECTORS)(
      'password $note → valid: $valid',
      async ({ input, valid }) => {
        const res = await signup(app, validBody({ password: input }));
        if (valid) {
          expect(res.status).toBe(201);
        } else {
          expect(res.status).toBe(400);
          expect(res.body).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: [
              {
                field: 'password',
                messages: [
                  'Password must be 8–128 characters and include a letter, a number and a special character',
                ],
              },
            ],
          });
        }
      },
    );

    it.each(NAME_VECTORS)(
      'name $note → valid: $valid',
      async ({ input, valid }) => {
        const res = await signup(app, validBody({ name: input }));
        if (valid) {
          expect(res.status).toBe(201);
        } else {
          expect(res.status).toBe(400);
          expect(res.body).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: [
              { field: 'name', messages: ['Name must be 3–50 characters'] },
            ],
          });
        }
      },
    );

    it.each(EMAIL_VECTORS)(
      'email $note → valid: $valid',
      async ({ input, valid, normalized }) => {
        // Valid fixed addresses are made unique by tagging the local part.
        const email =
          valid && !normalized ? input.replace('@', `+${Date.now()}@`) : input;
        await userModel.deleteMany({
          email: normalized ?? email.trim().toLowerCase(),
        });
        const res = await signup(app, validBody({ email }));
        if (valid) {
          expect(res.status).toBe(201);
          if (normalized) {
            expect((res.body as { user: { email: string } }).user.email).toBe(
              normalized,
            );
          }
        } else {
          expect(res.status).toBe(400);
          expect(res.body).toMatchObject({
            code: 'VALIDATION_ERROR',
            details: [
              { field: 'email', messages: ['Enter a valid email address'] },
            ],
          });
        }
      },
    );

    it('reports every invalid field at once', async () => {
      const res = await signup(app, {
        email: 'nope',
        name: 'A',
        password: 'x',
      });
      expect(res.status).toBe(400);
      const fields = (res.body as { details: { field: string }[] }).details.map(
        (d) => d.field,
      );
      expect(fields.sort()).toEqual(['email', 'name', 'password']);
    });

    it('rejects unknown fields', async () => {
      const res = await signup(app, validBody({ isAdmin: true }));
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({
        code: 'VALIDATION_ERROR',
        details: [{ field: 'isAdmin' }],
      });
    });

    it.each([
      ['email', 42],
      ['name', ['Ada']],
      ['password', 123456789],
      ['email', null],
    ])('rejects a wrong type for %s', async (field, value) => {
      const res = await signup(app, validBody({ [field]: value }));
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ details: [{ field }] });
    });

    it.each(['email', 'name', 'password'])(
      'rejects a Mongo operator object in %s',
      async (field) => {
        const res = await signup(app, validBody({ [field]: { $gt: '' } }));
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: 'VALIDATION_ERROR' });
      },
    );

    it('rejects missing fields', async () => {
      const res = await signup(app, {});
      expect(res.status).toBe(400);
      expect((res.body as { details: unknown[] }).details).toHaveLength(3);
    });
  });

  describe('duplicate email', () => {
    it('returns 409 and leaves the existing account untouched', async () => {
      const email = uniqueEmail();
      await signup(app, validBody({ email, name: 'Original' })).expect(201);
      const before = await userModel
        .findOne({ email })
        .select('+passwordHash')
        .lean()
        .exec();

      const res = await signup(
        app,
        validBody({
          email: ` ${email.toUpperCase()} `,
          name: 'Intruder',
          password: 'other123!',
        }),
      );

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({
        statusCode: 409,
        code: 'EMAIL_TAKEN',
        message: 'An account with this email already exists',
      });
      expect(setCookieHeaders(res)).toHaveLength(0);
      const after = await userModel
        .findOne({ email })
        .select('+passwordHash')
        .lean()
        .exec();
      expect(after).toEqual(before);
    });

    it('lets exactly one of five concurrent signups win', async () => {
      const email = uniqueEmail('race');
      const results = await Promise.all(
        Array.from({ length: 5 }, (_, i) =>
          signup(app, validBody({ email, name: `Racer ${i}` })),
        ),
      );
      const statuses = results.map((r) => r.status).sort();
      expect(statuses).toEqual([201, 409, 409, 409, 409]);
      expect(await userModel.countDocuments({ email })).toBe(1);
    });

    it('never logs the email from a raw duplicate-key error', async () => {
      const email = uniqueEmail('leak-check');
      await signup(app, validBody({ email })).expect(201);
      // Bypass the 409 mapping so the real E11000 error reaches the logs.
      jest
        .spyOn(app.get(UsersService), 'create')
        .mockImplementationOnce(async (input) => {
          await userModel.create(input);
          throw new Error('unreachable');
        });
      logs.clear();

      const res = await signup(app, validBody({ email }));

      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ code: 'INTERNAL_ERROR' });
      expect(logs.text).toContain('"code":11000');
      expect(logs.text).not.toContain(email);
      expect(logs.text).not.toContain('dup key');
    });
  });
});
