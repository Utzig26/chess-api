import { Controller, Get, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/interfaces/jwt-payload.interface';
import { WrapMessage } from '../common/decorators/wrap-message.decorator';
import {
  ApiEnvelopeErrorResponse,
  ApiEnvelopeResponse,
} from '../common/decorators/api-envelope-response.decorator';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @WrapMessage('Current user')
  @ApiOperation({ summary: 'Return the account behind the access token' })
  @ApiEnvelopeResponse({
    status: HttpStatus.OK,
    description: 'The authenticated account',
    type: UserResponseDto,
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing, malformed or expired access token',
  })
  async me(
    @CurrentUser() current: AuthenticatedUser,
  ): Promise<UserResponseDto> {
    const user = await this.usersService.findById(current.id);

    return UserResponseDto.from(user);
  }
}
