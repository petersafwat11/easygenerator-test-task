import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import type { UserResponseDto } from '../users/dto/user-response.dto';
import { toUserResponse } from '../users/user.mapper';
import { AuthService } from './auth.service';
import { SigninDto } from './dto/signin.dto';
import { SignupDto } from './dto/signup.dto';
import { SessionCookie } from './session-cookie';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookie: SessionCookie,
  ) {}

  @Public()
  @Post('signup')
  @HttpCode(201)
  async signup(
    @Body() dto: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: UserResponseDto; authenticated: boolean }> {
    const { user, session } = await this.auth.signup(
      dto,
      this.cookie.read(req),
    );
    if (session) this.cookie.set(res, session.token);
    return { user: toUserResponse(user), authenticated: session !== null };
  }

  @Public()
  @Post('signin')
  @HttpCode(200)
  async signin(
    @Body() dto: SigninDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ user: UserResponseDto }> {
    const { user, session } = await this.auth.signin(
      dto,
      this.cookie.read(req),
    );
    this.cookie.set(res, session.token);
    return { user: toUserResponse(user) };
  }

  /** Public so an already-expired session can still clear its cookie. */
  @Public()
  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(this.cookie.read(req));
    // Only reached once the server session is gone (or never existed).
    this.cookie.clear(res);
  }
}
