import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ApiEnvelopeDto {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: '2026-07-28T12:00:00.000Z' })
  timestamp: string;

  @ApiProperty({ example: '/auth/signin' })
  path: string;

  @ApiProperty({ example: 'OK' })
  message: string;

  @ApiProperty({ example: 'b1f0c3a2-9d5e-4a7b-8c1d-2e3f4a5b6c7d' })
  requestId: string;
}

export class SuccessEnvelopeDto extends ApiEnvelopeDto {
  @ApiProperty({ example: true })
  success: true;
}

export class ErrorEnvelopeDto extends ApiEnvelopeDto {
  @ApiProperty({ example: false })
  success: false;

  @ApiPropertyOptional({
    type: [String],
    description:
      'Field level validation messages, when the request was invalid',
    example: ['Password is too short, minimum length is 8 characters'],
  })
  errors?: string[];
}
