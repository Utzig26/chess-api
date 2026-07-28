import { PickType } from '@nestjs/swagger';
import { CreateUserDto } from './create-user.dto';

export class SignInDto extends PickType(CreateUserDto, [
  'username',
  'password',
]) {}
