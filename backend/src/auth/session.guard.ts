import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { IS_PUBLIC_KEY } from '../common/decorators/public.decorator';
import { AppError } from '../common/errors/app-error';
import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from '../users/users.service';
import type { AuthenticatedRequest } from './current-user.decorator';
import { SessionCookie } from './session-cookie';

/**
 * Global guard: deny by default; only `@Public()` routes skip it. 401 means
 * exactly "no valid session". A failing lookup is a 503, never a 401, so an
 * outage is not mistaken for being signed out.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly cookie: SessionCookie,
    private readonly sessions: SessionsService,
    private readonly users: UsersService,
    @InjectPinoLogger(SessionGuard.name) private readonly logger: PinoLogger,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = this.cookie.read(req);
    // Malformed or missing cookies never reach the database.
    if (!SessionsService.isWellFormed(token)) {
      throw AppError.unauthenticated();
    }

    let session: Awaited<ReturnType<SessionsService['findValid']>>;
    let user: Awaited<ReturnType<UsersService['findById']>> = null;
    try {
      session = await this.sessions.findValid(token);
      if (session) user = await this.users.findById(session.userId);
    } catch (error) {
      this.logger.warn({ err: error }, 'Session lookup failed');
      throw AppError.serviceUnavailable();
    }

    if (!session || !user) throw AppError.unauthenticated();

    req.auth = { userId: user._id, sessionId: session._id, user };
    return true;
  }
}
