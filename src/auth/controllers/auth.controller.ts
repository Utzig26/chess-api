import { Body, Controller, Post, UseGuards, ValidationPipe, Request } from "@nestjs/common";

import { UsersDTO } from "src/users/dto/users.dto";
import { UsersService } from "src/users/users.service";
import { AuthService } from "../auth.service";
import { LocalAuthGuard } from "../guards/local-auth-guard";

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService
  ) {}

  @Post('signup')
  async signUp(
    @Body(ValidationPipe) usersDTO: UsersDTO
  ): Promise<any> {
    const authUser = await this.authService.signUp(usersDTO);
    const token = await this.authService.signIn(authUser);
    const user = this.usersService.extractUserData(authUser);

    return { user, token };
  }

  @UseGuards(LocalAuthGuard)
  @Post('signin')
  async signIn(@Request() req) {
    return this.authService.signIn(req.user);
  }
}