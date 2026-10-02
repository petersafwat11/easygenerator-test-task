import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Types } from 'mongoose';
import { AppError } from '../common/errors/app-error';
import type { UserRecord } from '../users/schemas/user.schema';

/** What the session guard attaches to an authenticated request. */
export interface AuthContext {
  userId: Types.ObjectId;
  sessionId: Types.ObjectId;
  user: UserRecord;
}

export type AuthenticatedRequest = Request & { auth?: AuthContext };

/** The signed-in user's context. Only valid on routes behind the session guard. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthContext => {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!req.auth) throw AppError.unauthenticated();
    return req.auth;
  },
);
