import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UserCreateDto } from '../users/dto/user.create.dto';
import { UserSignDto } from '../users/dto/user.sign.dto';
import { WrapMessage } from '../utils/decorators/wrap-message.decorator';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  @WrapMessage('User created')
  async signUp(
    @Body() userCreateDto: UserCreateDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.signUp(userCreateDto);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @WrapMessage('User signed in')
  async signIn(
    @Body() userSignDto: UserSignDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.signIn(userSignDto);
  }
}
