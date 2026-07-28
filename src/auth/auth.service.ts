import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { SignInDto } from '../users/dto/sign-in.dto';
import { UserDocument } from '../users/schema/user.schema';
import { AccessTokenDto } from './dto/access-token.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async signUp(createUserDto: CreateUserDto): Promise<AccessTokenDto> {
    const user = await this.usersService.create(createUserDto);

    return this.issueAccessToken(user);
  }

  async signIn(signInDto: SignInDto): Promise<AccessTokenDto> {
    const user = await this.usersService.checkPassword(signInDto);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueAccessToken(user);
  }

  private async issueAccessToken(user: UserDocument): Promise<AccessTokenDto> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      type: 'access',
    };

    return { accessToken: await this.jwtService.signAsync(payload) };
  }
}
