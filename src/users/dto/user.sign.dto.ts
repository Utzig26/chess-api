import { PickType } from '@nestjs/swagger';
import { UserCreateDto } from './user.create.dto';
export class UserSignDto extends PickType(UserCreateDto, [
  'username',
  'password',
]) {}
