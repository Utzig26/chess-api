import { ApiProperty } from '@nestjs/swagger';

export class AccessTokenDto {
  @ApiProperty({
    description: 'Bearer token to be sent in the Authorization header',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  readonly accessToken: string;
}
