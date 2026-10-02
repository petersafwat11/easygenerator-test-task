import type { UserResponseDto } from './dto/user-response.dto';
import type { UserRecord } from './schemas/user.schema';

/** The only way a user leaves the API: an explicit allowlist, never a raw document. */
export function toUserResponse(user: UserRecord): UserResponseDto {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    createdAt: user.createdAt.toISOString(),
  };
}
