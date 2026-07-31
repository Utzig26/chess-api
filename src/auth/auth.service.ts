import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { SignInDto } from '../users/dto/sign-in.dto';
import { UserDocument } from '../users/schema/user.schema';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { RefreshTokenService } from './refresh-token.service';

export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
}

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private refreshTokenService: RefreshTokenService,
    private jwtService: JwtService,
  ) {}

  async signUp(createUserDto: CreateUserDto): Promise<AuthSession> {
    const user = await this.usersService.create(createUserDto);

    return this.startSession(user);
  }

  async signIn(signInDto: SignInDto): Promise<AuthSession> {
    const user = await this.usersService.checkPassword(signInDto);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.startSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthSession> {
    const rotated = await this.refreshTokenService.rotate(refreshToken);

    return {
      accessToken: await this.signAccessToken(
        rotated.user.id,
        rotated.user.username,
      ),
      refreshToken: rotated.token,
      refreshExpiresAt: rotated.expiresAt,
    };
  }

  async signOut(refreshToken: string): Promise<void> {
    await this.refreshTokenService.revokeByToken(refreshToken);
  }

  async signOutEverywhere(userId: string): Promise<void> {
    await this.refreshTokenService.revokeAllForUser(userId);
  }

  private async startSession(user: UserDocument): Promise<AuthSession> {
    const refresh = await this.refreshTokenService.issue(user);

    return {
      accessToken: await this.signAccessToken(user.id, user.username),
      refreshToken: refresh.token,
      refreshExpiresAt: refresh.expiresAt,
    };
  }

  private async signAccessToken(
    userId: string,
    username: string,
  ): Promise<string> {
    const payload: JwtPayload = {
      sub: userId,
      username,
      type: 'access',
    };

    return this.jwtService.signAsync(payload);
  }
}
