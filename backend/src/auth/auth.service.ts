import { HttpStatus, Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { AppError } from '../common/errors/app-error';
import { ErrorCode } from '../common/errors/error-codes';
import { NewSession, SessionsService } from '../sessions/sessions.service';
import type { UserRecord } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import type { SigninDto } from './dto/signin.dto';
import type { SignupDto } from './dto/signup.dto';
import { PasswordService } from './password.service';

export interface SignupResult {
  user: UserRecord;
  /** null when the account was created but its session could not be saved. */
  session: NewSession | null;
}

export interface SigninResult {
  user: UserRecord;
  session: NewSession;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly passwords: PasswordService,
    @InjectPinoLogger(AuthService.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Two writes without a transaction. If the session insert fails the account
   * still exists, so the result says so honestly instead of pretending signup failed.
   */
  async signup(dto: SignupDto, currentToken?: string): Promise<SignupResult> {
    const passwordHash = await this.passwords.hash(dto.password);
    const user = await this.users.create({
      email: dto.email,
      name: dto.name,
      passwordHash,
    });

    let session: NewSession;
    try {
      session = await this.sessions.create(user._id);
    } catch (error) {
      this.logger.error(
        { err: error, userId: user._id.toString() },
        'Signup created the user but not the session',
      );
      return { user, session: null };
    }

    await this.retire(currentToken);
    return { user, session };
  }

  /**
   * Unknown email and wrong password are indistinguishable to the caller. A new
   * token on every sign-in also prevents session fixation.
   */
  async signin(dto: SigninDto, currentToken?: string): Promise<SigninResult> {
    const found = await this.users.findByEmailWithPassword(dto.email);
    const valid = found
      ? await this.passwords.verify(found.passwordHash, dto.password)
      : await this.passwords.verifyDummy(dto.password);
    if (!found || !valid) {
      throw new AppError(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.INVALID_CREDENTIALS,
      );
    }

    let session: NewSession;
    try {
      session = await this.sessions.create(found._id);
    } catch (error) {
      // The existing cookie and session stay untouched: a failed replacement
      // must never destroy a working login.
      this.logger.error({ err: error }, 'Could not create a session on signin');
      throw AppError.serviceUnavailable();
    }

    await this.retire(currentToken);
    const user: UserRecord = {
      _id: found._id,
      email: found.email,
      name: found.name,
      createdAt: found.createdAt,
    };
    return { user, session };
  }

  /** Idempotent: no cookie or an unknown token still succeeds. */
  async logout(token: string | undefined): Promise<void> {
    if (!SessionsService.isWellFormed(token)) return;
    try {
      await this.sessions.deleteByToken(token);
    } catch (error) {
      this.logger.warn(
        { err: error },
        'Could not delete the session on logout',
      );
      throw AppError.serviceUnavailable();
    }
  }

  /**
   * Deletes the session the request arrived with, only after its replacement is
   * saved. A failure here is logged and ignored: the old session expires anyway.
   */
  private async retire(token: string | undefined): Promise<void> {
    if (!SessionsService.isWellFormed(token)) return;
    try {
      await this.sessions.deleteByToken(token);
    } catch (error) {
      this.logger.warn({ err: error }, 'Could not delete the replaced session');
    }
  }
}
