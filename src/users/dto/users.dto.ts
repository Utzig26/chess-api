import {
  IsString,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

export class UsersDTO {

  @IsString()
  @MaxLength(32, { message: 'Username must be at least 32 characters long' })
  @MinLength(2, { message: 'Username must be at least 2 characters long'})
  @Matches(/^(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$/, {message: 'Username can only contain alphanumeric charcters, _ and .'})
  username: string;

  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters long' })
  @MaxLength(128, { message: 'Password must be at maximum 128 characters long' })
  password: string;
}