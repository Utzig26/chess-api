import {
  Inject,
  Injectable,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common';
import { UsersService } from 'src/users/users.service';
import { UserCreateDto } from 'src/users/dto/user.create.dto';
import { JwtService } from '@nestjs/jwt';
import { User } from '../users/schema/user.schema';
import { UserSignDto } from '../users/dto/user.sign.dto';

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(UserSignDto: UserSignDto): Promise<User | null> {
    return await this.usersService.checkPassword(UserSignDto);
  }

  async signUp(
    createUserDto: UserCreateDto,
  ): Promise<{ access_token: string }> {
    const user = await this.usersService.create(createUserDto);
    const jwtPayload = {
      sub: user.id,
      username: user.username,
    };

    return {
      access_token: await this.jwtService.signAsync(jwtPayload),
    };
  }

  async signIn(userSignDto: UserSignDto): Promise<{ access_token: string }> {
    const user = await this.usersService.checkPassword(userSignDto);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const jwtPayload = {
      sub: user.id,
      username: user.username,
    };

    return {
      access_token: await this.jwtService.signAsync(jwtPayload),
    };
  }
}
