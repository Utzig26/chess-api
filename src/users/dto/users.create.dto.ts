import { IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class CreateUserDto {
    @IsString()
    @MaxLength(32, { message: 'Username is too long, maximum length is 32 characters' })
    @MinLength(2, { message: 'Username is too short, minimum length is 2 characters' })
    @Matches(/^(?![_.])(?!.*[_.]{2})[a-zA-Z0-9._]+(?<![_.])$/, { message: 'Username is invalid, it must contain only alphanumeric characters, underscores and dots' })
    readonly username: string;

    @IsString()
    @MinLength(8, { message: 'Password is too short, minimum length is 8 characters'})
    @MaxLength(128, { message: 'Password is too long, maximum length is 128 characters'})
    readonly password: string;
}