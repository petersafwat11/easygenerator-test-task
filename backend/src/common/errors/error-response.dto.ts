import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ErrorCode } from './error-codes';

export class FieldErrorDto {
  @ApiProperty({ example: 'password' })
  field!: string;

  @ApiProperty({ type: [String] })
  messages!: string[];
}

/** The one error shape every endpoint returns. Documentation only. */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({ enum: Object.values(ErrorCode), example: 'VALIDATION_ERROR' })
  code!: string;

  @ApiProperty({ example: 'Check the highlighted fields.' })
  message!: string;

  @ApiPropertyOptional({
    type: [FieldErrorDto],
    description: 'Only for VALIDATION_ERROR from DTO validation.',
  })
  details?: FieldErrorDto[];

  @ApiProperty({ example: '0b6c1f7e-3c2a-4d8e-9f10-2a3b4c5d6e7f' })
  requestId!: string;
}
