import { Exclude } from 'class-transformer';

export class UserDto {
  readonly id: string;
  readonly username: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  @Exclude()
  readonly password: string;

  constructor(partial: Partial<UserDto>) {
    Object.assign(this, partial);
  }
}
