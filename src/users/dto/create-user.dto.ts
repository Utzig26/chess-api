import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

const USERNAME_PATTERN = /^(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$/;

export class CreateUserDto {
  @ApiProperty({
    description:
      'Alphanumeric characters, dots and underscores. Cannot start or end with a dot or underscore, nor contain two of them in a row.',
    minLength: 2,
    maxLength: 32,
    example: 'magnus.carlsen',
  })
  @Matches(USERNAME_PATTERN, {
    message:
      'Username is invalid, it must contain only alphanumeric characters, underscores and dots',
  })
  @MaxLength(32, {
    message: 'Username is too long, maximum length is 32 characters',
  })
  @MinLength(2, {
    message: 'Username is too short, minimum length is 2 characters',
  })
  @IsString()
  readonly username: string;

  @ApiProperty({
    minLength: 8,
    maxLength: 128,
    example: 'a-strong-password',
  })
  @MaxLength(128, {
    message: 'Password is too long, maximum length is 128 characters',
  })
  @MinLength(8, {
    message: 'Password is too short, minimum length is 8 characters',
  })
  @IsString()
  readonly password: string;
}
