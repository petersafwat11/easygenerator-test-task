import { ApiProperty } from '@nestjs/swagger';
import { UserEnvelopeDto } from '../../users/dto/user-response.dto';

export class SignupResponseDto extends UserEnvelopeDto {
  @ApiProperty({
    description:
      'false when the account was created but its session could not be saved: no cookie is set and the user should sign in.',
  })
  authenticated!: boolean;
}
