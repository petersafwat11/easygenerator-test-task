import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  MESSAGES,
  NAME_PATTERN,
  Normalize,
  PASSWORD_PATTERN,
} from './validation-rules';

export class SignupDto {
  @ApiProperty({
    example: 'ada@example.com',
    maxLength: EMAIL_MAX_LENGTH,
    description: 'Trimmed and lowercased before use.',
  })
  @Normalize({ lowercase: true })
  @IsString({ message: MESSAGES.email })
  @MaxLength(EMAIL_MAX_LENGTH, { message: MESSAGES.email })
  @IsEmail({ require_tld: true }, { message: MESSAGES.email })
  email!: string;

  @ApiProperty({
    example: 'Ada Lovelace',
    description: 'Trimmed; 3–50 Unicode code points, no control characters.',
  })
  @Normalize()
  @IsString({ message: MESSAGES.name })
  @Matches(NAME_PATTERN, { message: MESSAGES.name })
  name!: string;

  @ApiProperty({
    example: 'abc12345!',
    format: 'password',
    description:
      '8–128 code points with a letter, a digit and a special character (Unicode punctuation or symbol). Never trimmed.',
  })
  @IsString({ message: MESSAGES.password })
  @Matches(PASSWORD_PATTERN, { message: MESSAGES.password })
  password!: string;
}
