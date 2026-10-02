import { Controller, Get } from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthContext } from '../auth/current-user.decorator';
import { SESSION_COOKIE_SECURITY } from '../common/swagger';
import { ErrorResponseDto } from '../common/errors/error-response.dto';
import { UserEnvelopeDto } from './dto/user-response.dto';
import { toUserResponse } from './user.mapper';

@ApiTags('users')
@ApiCookieAuth(SESSION_COOKIE_SECURITY)
@Controller('users')
export class UsersController {
  /** Protected by the global session guard, which already loaded the user. */
  @Get('me')
  @ApiOperation({ summary: 'The signed-in user' })
  @ApiOkResponse({ type: UserEnvelopeDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'UNAUTHENTICATED: no valid session',
  })
  @ApiServiceUnavailableResponse({
    type: ErrorResponseDto,
    description: 'Database unavailable (never reported as 401)',
  })
  me(@CurrentUser() auth: AuthContext): UserEnvelopeDto {
    return { user: toUserResponse(auth.user) };
  }
}
