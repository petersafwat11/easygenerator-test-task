import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPayloadTooLargeResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
  ApiUnsupportedMediaTypeResponse,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { ErrorResponseDto } from '../common/errors/error-response.dto';
import { AuthThrottle } from '../common/throttling/throttling';
import { UserEnvelopeDto } from '../users/dto/user-response.dto';
import { toUserResponse } from '../users/user.mapper';
import { AuthService } from './auth.service';
import { SigninDto } from './dto/signin.dto';
import { SignupResponseDto } from './dto/signup-response.dto';
import { SignupDto } from './dto/signup.dto';
import { SessionCookie } from './session-cookie';

const error = { type: ErrorResponseDto };

@ApiTags('auth')
@ApiUnsupportedMediaTypeResponse({
  ...error,
  description: 'Body is not application/json',
})
@ApiServiceUnavailableResponse({
  ...error,
  description: 'Database unavailable',
})
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookie: SessionCookie,
  ) {}

  @Public()
  @AuthThrottle()
  @Post('signup')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Create an account and sign in',
    description:
      'Sets the httpOnly session cookie when `authenticated` is true.',
  })
  @ApiCreatedResponse({ type: SignupResponseDto })
  @ApiBadRequestResponse({ ...error, description: 'Validation failed' })
  @ApiConflictResponse({ ...error, description: 'EMAIL_TAKEN' })
  @ApiPayloadTooLargeResponse({ ...error, description: 'Body over 10 kb' })
  @ApiTooManyRequestsResponse({ ...error, description: 'See Retry-After' })
  async signup(
    @Body() dto: SignupDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SignupResponseDto> {
    const { user, session } = await this.auth.signup(
      dto,
      this.cookie.read(req),
    );
    if (session) this.cookie.set(res, session.token);
    return { user: toUserResponse(user), authenticated: session !== null };
  }

  @Public()
  @AuthThrottle()
  @Post('signin')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Sign in',
    description:
      'Issues a new session cookie and retires the one the request carried.',
  })
  @ApiOkResponse({ type: UserEnvelopeDto })
  @ApiBadRequestResponse({ ...error, description: 'Validation failed' })
  @ApiUnauthorizedResponse({ ...error, description: 'INVALID_CREDENTIALS' })
  @ApiPayloadTooLargeResponse({ ...error, description: 'Body over 10 kb' })
  @ApiTooManyRequestsResponse({ ...error, description: 'See Retry-After' })
  async signin(
    @Body() dto: SigninDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<UserEnvelopeDto> {
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
  @ApiOperation({
    summary: 'Sign out of this session',
    description:
      'Deletes the server session and clears the cookie. Idempotent. Send `{}` as the body.',
  })
  @ApiNoContentResponse({ description: 'Signed out (or was not signed in)' })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(this.cookie.read(req));
    // Only reached once the server session is gone (or never existed).
    this.cookie.clear(res);
  }
}
