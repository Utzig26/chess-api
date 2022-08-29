import { Controller, Get, UseGuards, Request } from "@nestjs/common";
import { JwtAuthGuard } from "src/common/guards/jwt-auth.guard";
import { UsersService } from "./users.service";

@Controller('users')
export class UsersController {
  constructor(
    private usersService: UsersService
  ) {}

  @UseGuards(JwtAuthGuard)
  @Get(['/me','/']) // Meanwhile there is no why '/users' return a list of user. But, for future implementation the docs will reference only '/users/me'
  getUser(@Request() req) {
    return this.usersService.extractUserData(req.user['user']);
  }
}

