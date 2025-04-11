import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';

import { UserCreateDto } from 'src/users/dto/user.create.dto';
import { UserSignDto } from '../users/dto/user.sign.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    //private usersService: UsersService
  ) {}

  @Post('signup')
  async signUp(
    @Body(ValidationPipe) userCreateDto: UserCreateDto,
  ): Promise<{ access_token: string }> {
    const jwt = await this.authService.signUp(userCreateDto);
    return jwt;
  }

  @Post('signin')
  async signIn(
    @Body(ValidationPipe) userSignDto: UserSignDto,
  ): Promise<{ access_token: string }> {
    const jwt = await this.authService.signIn(userSignDto);
    return jwt;
  }
}
