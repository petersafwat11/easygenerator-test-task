import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { NewSession, SessionsService } from '../sessions/sessions.service';
import type { UserRecord } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';
import type { SignupDto } from './dto/signup.dto';
import { PasswordService } from './password.service';

export interface SignupResult {
  user: UserRecord;
  /** null when the account was created but its session could not be saved. */
  session: NewSession | null;
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
