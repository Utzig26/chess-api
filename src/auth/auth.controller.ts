import { Body, Controller, Post, ValidationPipe } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserCreateDto } from 'src/users/dto/user.create.dto';
import { UserSignDto } from '../users/dto/user.sign.dto';
import { WrapMessage } from '../utils/decorators/wrap-message.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  @WrapMessage('User created')
  async signUp(
    @Body(ValidationPipe) userCreateDto: UserCreateDto,
  ): Promise<{ access_token: string }> {
    return await this.authService.signUp(userCreateDto);
  }

  @WrapMessage('User signed in')
  @Post('signin')
  async signIn(
    @Body(ValidationPipe) userSignDto: UserSignDto,
  ): Promise<{ access_token: string }> {
    const jwt = await this.authService.signIn(userSignDto);
    return jwt;
  }
}
