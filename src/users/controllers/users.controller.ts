import { Controller, Get, UseGuards, Request } from "@nestjs/common";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { UsersService } from "../users.service";

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get('user')
  getUser(@Request() req) {
    return this.usersService.extractUserData(req.user['user']);
  }
}