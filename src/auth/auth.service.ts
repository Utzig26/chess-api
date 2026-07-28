import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { UserCreateDto } from '../users/dto/user.create.dto';
import { UserSignDto } from '../users/dto/user.sign.dto';
import { UserDocument } from '../users/schema/user.schema';
import { JwtPayload } from './interfaces/jwt-payload.interface';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async signUp(userCreateDto: UserCreateDto): Promise<{ accessToken: string }> {
    const user = await this.usersService.create(userCreateDto);

    return this.issueAccessToken(user);
  }

  async signIn(userSignDto: UserSignDto): Promise<{ accessToken: string }> {
    const user = await this.usersService.checkPassword(userSignDto);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.issueAccessToken(user);
  }

  private async issueAccessToken(
    user: UserDocument,
  ): Promise<{ accessToken: string }> {
    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      type: 'access',
    };

    return { accessToken: await this.jwtService.signAsync(payload) };
  }
}
