import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';

import { CreateUserDto } from 'src/users/dto/users.create.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    //private usersService: UsersService
  ) {}

  @Post('signup')
  async signUp(
    @Body(ValidationPipe) createUserDto: CreateUserDto,
  ): Promise<{ access_token: string }> {
    const jwt = await this.authService.signUp(createUserDto);
    return jwt;
  }
}
