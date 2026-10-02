import { IsEmail, IsString, Matches, MaxLength } from 'class-validator';
import {
  EMAIL_MAX_LENGTH,
  MESSAGES,
  NAME_PATTERN,
  Normalize,
  PASSWORD_PATTERN,
} from './validation-rules';

export class SignupDto {
  @Normalize({ lowercase: true })
  @IsString({ message: MESSAGES.email })
  @MaxLength(EMAIL_MAX_LENGTH, { message: MESSAGES.email })
  @IsEmail({ require_tld: true }, { message: MESSAGES.email })
  email!: string;

  @Normalize()
  @IsString({ message: MESSAGES.name })
  @Matches(NAME_PATTERN, { message: MESSAGES.name })
  name!: string;

  /** Never trimmed or case-changed. */
  @IsString({ message: MESSAGES.password })
  @Matches(PASSWORD_PATTERN, { message: MESSAGES.password })
  password!: string;
}
