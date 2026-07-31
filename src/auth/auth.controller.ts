import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Request, Response } from 'express';
import { AuthService, AuthSession } from './auth.service';
import { AccessTokenDto } from './dto/access-token.dto';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthenticatedUser } from './interfaces/jwt-payload.interface';
import {
  REFRESH_COOKIE_NAME,
  clearRefreshCookie,
  setRefreshCookie,
} from './refresh-cookie';
import { CreateUserDto } from '../users/dto/create-user.dto';
import { SignInDto } from '../users/dto/sign-in.dto';
import { WrapMessage } from '../common/decorators/wrap-message.decorator';
import {
  ApiEnvelopeErrorResponse,
  ApiEnvelopeResponse,
} from '../common/decorators/api-envelope-response.decorator';
import { AppConfig } from '../config/configuration';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly isProduction: boolean;

  constructor(
    private authService: AuthService,
    config: ConfigService,
  ) {
    this.isProduction =
      config.getOrThrow<AppConfig>('app').environment === 'production';
  }

  @Post('signup')
  @UseGuards(AuthThrottlerGuard)
  @WrapMessage('User created')
  @ApiOperation({ summary: 'Register a new account and open a session' })
  @ApiEnvelopeResponse({
    status: HttpStatus.CREATED,
    description: 'Account created, refresh token set as a cookie',
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
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many attempts from this address',
  })
  async signUp(
    @Body() createUserDto: CreateUserDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenDto> {
    return this.respondWithSession(
      await this.authService.signUp(createUserDto),
      response,
    );
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @WrapMessage('User signed in')
  @ApiOperation({ summary: 'Exchange credentials for a session' })
  @ApiEnvelopeResponse({
    status: HttpStatus.OK,
    description: 'Credentials accepted, refresh token set as a cookie',
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
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many attempts from this address',
  })
  async signIn(
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenDto> {
    return this.respondWithSession(
      await this.authService.signIn(signInDto),
      response,
    );
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthThrottlerGuard)
  @WrapMessage('Session refreshed')
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOperation({
    summary: 'Rotate the refresh token cookie and issue a new access token',
  })
  @ApiEnvelopeResponse({
    status: HttpStatus.OK,
    description: 'A new token pair was issued and the old one revoked',
    type: AccessTokenDto,
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.UNAUTHORIZED,
    description:
      'The cookie is missing, expired, unknown, or was already used, in which case the whole session family is revoked',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.TOO_MANY_REQUESTS,
    description: 'Too many attempts from this address',
  })
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccessTokenDto> {
    const session = await this.authService.refresh(
      this.readRefreshCookie(request),
    );

    return this.respondWithSession(session, response);
  }

  @Post('signout')
  @HttpCode(HttpStatus.OK)
  @WrapMessage('User signed out')
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOperation({ summary: 'Revoke the current session and clear the cookie' })
  @ApiEnvelopeResponse({
    status: HttpStatus.OK,
    description: 'Session revoked',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'No refresh cookie was sent',
  })
  async signOut(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<null> {
    await this.authService.signOut(this.readRefreshCookie(request));
    clearRefreshCookie(response, this.isProduction);

    return null;
  }

  @Post('signout-all')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @WrapMessage('All sessions revoked')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Revoke every session of the authenticated account',
  })
  @ApiEnvelopeResponse({
    status: HttpStatus.OK,
    description: 'Every refresh token of the account was revoked',
  })
  @ApiEnvelopeErrorResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Missing, malformed or expired access token',
  })
  async signOutEverywhere(
    @CurrentUser() current: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<null> {
    await this.authService.signOutEverywhere(current.id);
    clearRefreshCookie(response, this.isProduction);

    return null;
  }

  private respondWithSession(
    session: AuthSession,
    response: Response,
  ): AccessTokenDto {
    setRefreshCookie(
      response,
      session.refreshToken,
      session.refreshExpiresAt,
      this.isProduction,
    );

    return { accessToken: session.accessToken };
  }

  private readRefreshCookie(request: Request): string {
    const token = request.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) {
      throw new UnauthorizedException('Missing refresh token');
    }

    return token;
  }
}
