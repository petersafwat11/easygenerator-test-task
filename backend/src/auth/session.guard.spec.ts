import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import type { PinoLogger } from 'nestjs-pino';
import { AppError } from '../common/errors/app-error';
import type { SessionsService } from '../sessions/sessions.service';
import type { UsersService } from '../users/users.service';
import type { AuthenticatedRequest } from './current-user.decorator';
import { SessionCookie } from './session-cookie';
import { SessionGuard } from './session.guard';

const TOKEN = 'A'.repeat(43);

function contextFor(req: Partial<AuthenticatedRequest>): ExecutionContext {
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('SessionGuard', () => {
  const sessions = { findValid: jest.fn() };
  const users = { findById: jest.fn() };
  const reflector = { getAllAndOverride: jest.fn() };
  const cookie = { read: jest.fn() };
  const logger = { warn: jest.fn() };
  const guard = new SessionGuard(
    reflector as unknown as Reflector,
    cookie as unknown as SessionCookie,
    sessions as unknown as SessionsService,
    users as unknown as UsersService,
    logger as unknown as PinoLogger,
  );

  beforeEach(() => {
    jest.resetAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
  });

  it('lets @Public routes through without reading the cookie', async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    await expect(guard.canActivate(contextFor({}))).resolves.toBe(true);
    expect(cookie.read).not.toHaveBeenCalled();
  });

  it.each([undefined, '', 'short', 'A'.repeat(44), '+'.repeat(43)])(
    'rejects cookie %p before touching the database',
    async (value) => {
      cookie.read.mockReturnValue(value);
      await expect(guard.canActivate(contextFor({}))).rejects.toBeInstanceOf(
        AppError,
      );
      expect(sessions.findValid).not.toHaveBeenCalled();
    },
  );

  it('is 401 when no valid session exists', async () => {
    cookie.read.mockReturnValue(TOKEN);
    sessions.findValid.mockResolvedValue(null);
    const error = await guard
      .canActivate(contextFor({}))
      .catch((e: unknown) => e);
    expect((error as AppError).getStatus()).toBe(401);
  });

  it('is 503, never 401, when the lookup fails', async () => {
    cookie.read.mockReturnValue(TOKEN);
    sessions.findValid.mockRejectedValue(new Error('db down'));
    const error = await guard
      .canActivate(contextFor({}))
      .catch((e: unknown) => e);
    expect((error as AppError).getStatus()).toBe(503);
  });

  it('attaches the auth context for a valid session', async () => {
    const user = {
      _id: new Types.ObjectId(),
      email: 'a@b.co',
      name: 'Ada',
      createdAt: new Date(),
    };
    const session = { _id: new Types.ObjectId(), userId: user._id };
    cookie.read.mockReturnValue(TOKEN);
    sessions.findValid.mockResolvedValue(session);
    users.findById.mockResolvedValue(user);
    const req: Partial<AuthenticatedRequest> = {};

    await expect(guard.canActivate(contextFor(req))).resolves.toBe(true);
    expect(req.auth).toEqual({
      userId: user._id,
      sessionId: session._id,
      user,
    });
  });
});
