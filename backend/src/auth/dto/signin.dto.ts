import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  MESSAGES,
  Normalize,
  SIGNIN_PASSWORD_PATTERN,
} from './validation-rules';

export class SigninDto {
  @Normalize({ lowercase: true })
  @IsString({ message: MESSAGES.email })
  @MaxLength(EMAIL_MAX_LENGTH, { message: MESSAGES.email })
  @IsEmail({ require_tld: true }, { message: MESSAGES.email })
  email!: string;

  @IsString({ message: MESSAGES.signinPassword })
  @Matches(SIGNIN_PASSWORD_PATTERN, { message: MESSAGES.signinPassword })
  password!: string;
}
