import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength } from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  EMAIL_PATTERN,
  MESSAGES,
  Normalize,
  SIGNIN_PASSWORD_PATTERN,
} from './validation-rules';

export class SigninDto {
  @ApiProperty({ example: 'ada@example.com', maxLength: EMAIL_MAX_LENGTH })
  @Normalize({ lowercase: true })
  @IsString({ message: MESSAGES.email })
  @MaxLength(EMAIL_MAX_LENGTH, { message: MESSAGES.email })
  @Matches(EMAIL_PATTERN, { message: MESSAGES.email })
  email!: string;

  @ApiProperty({
    example: 'abc12345!',
    format: 'password',
    description:
      '1–128 characters. The signup policy is deliberately not re-applied.',
  })
  @IsString({ message: MESSAGES.signinPassword })
  @Matches(SIGNIN_PASSWORD_PATTERN, { message: MESSAGES.signinPassword })
  password!: string;
}
