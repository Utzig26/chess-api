import { Body, Controller, Post, UseGuards, ValidationPipe, Request, Res } from "@nestjs/common";
import { Response } from "express";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";

import { UsersDTO } from "src/users/dto/users.dto";
import { UsersService } from "src/users/users.service";
import { AuthService } from "./auth.service";
import { LocalAuthGuard } from "./guards/local-auth-guard";

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService
  ) {}

  @Post('signup')
  async signUp(
    @Body(ValidationPipe) usersDTO: UsersDTO,
    @Res({passthrough: true}) response: Response
  ): Promise<any> {
    const authUser = await this.authService.signUp(usersDTO);
    const token = await this.authService.signIn(authUser);
    const user = this.usersService.extractUserData(authUser);
    
    response.cookie('jwt', token, {httpOnly:true});
    return { user: user, accessToken: token };
  }

  @UseGuards(LocalAuthGuard)
  @Post('signin')
  async signIn(
    @Request() req,
    @Res({passthrough: true}) response: Response
  ) {
    const token = await this.authService.signIn(req.user);
    
    response.cookie('jwt', token, {httpOnly:true});
    return { accessToken: token };
  }

  @UseGuards(JwtAuthGuard)
  @Post('signout')
  async signout(
    @Res({passthrough: true}) response: Response
  ){
    response.clearCookie('jwt');
    return {
      message: "success"
    }
  }
}