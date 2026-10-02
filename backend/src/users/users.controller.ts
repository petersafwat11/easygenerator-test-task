import { Controller, Get } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthContext } from '../auth/current-user.decorator';
import type { UserResponseDto } from './dto/user-response.dto';
import { toUserResponse } from './user.mapper';

@Controller('users')
export class UsersController {
  /** Protected by the global session guard, which already loaded the user. */
  @Get('me')
  me(@CurrentUser() auth: AuthContext): { user: UserResponseDto } {
    return { user: toUserResponse(auth.user) };
  }
}
