import { ApiProperty } from '@nestjs/swagger';

export class UserResponseDto {
  @ApiProperty({ example: '665f1c2e9b1e8a3d4c5b6a79' })
  id!: string;

  @ApiProperty({ example: 'ada@example.com' })
  email!: string;

  @ApiProperty({ example: 'Ada Lovelace' })
  name!: string;

  @ApiProperty({ format: 'date-time', example: '2026-10-02T12:00:00.000Z' })
  createdAt!: string;
}

export class UserEnvelopeDto {
  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}
