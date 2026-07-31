import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { AccessTokenDto } from './dto/access-token.dto';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { SignInDto } from '../users/dto/sign-in.dto';
import { WrapMessage } from '../common/decorators/wrap-message.decorator';
import {
  ApiEnvelopeErrorResponse,
  ApiEnvelopeResponse,
} from '../common/decorators/api-envelope-response.decorator';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('signup')
  @WrapMessage('User created')
  @ApiOperation({ summary: 'Register a new account and issue an access token' })
  @ApiEnvelopeResponse({
    status: HttpStatus.CREATED,
    description: 'Account created',
    type: AccessTokenDto,
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'The username or the password does not meet the requirements',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.CONFLICT,
    description: 'The username is already taken',
  })
  async signUp(@Body() createUserDto: CreateUserDto): Promise<AccessTokenDto> {
    return this.authService.signUp(createUserDto);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @WrapMessage('User signed in')
  @ApiOperation({ summary: 'Exchange credentials for an access token' })
  @ApiEnvelopeResponse({
    status: HttpStatus.OK,
    description: 'Credentials accepted',
    type: AccessTokenDto,
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'The request body is malformed',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Unknown username or wrong password',
  })
  async signIn(@Body() signInDto: SignInDto): Promise<AccessTokenDto> {
    return this.authService.signIn(signInDto);
  }
}
