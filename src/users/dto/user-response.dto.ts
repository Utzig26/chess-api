import { ApiProperty } from '@nestjs/swagger';
import { UserDocument } from '../schema/user.schema';

export class UserResponseDto {
  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  readonly id: string;

  @ApiProperty({ example: 'magnus.carlsen' })
  readonly username: string;

  @ApiProperty({ example: '2026-07-28T12:00:00.000Z' })
  readonly createdAt: Date;

  @ApiProperty({ example: '2026-07-28T12:00:00.000Z' })
  readonly updatedAt: Date;

  constructor(user: UserDocument) {
    this.id = user.id;
    this.username = user.username;
    this.createdAt = user.get('createdAt');
    this.updatedAt = user.get('updatedAt');
  }
}
