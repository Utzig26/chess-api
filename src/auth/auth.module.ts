import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard';
import { JwtStrategy } from './strategies/jwt.strategy';
import {
  RefreshToken,
  RefreshTokenSchema,
} from './schema/refresh-token.schema';
import { UsersModule } from '../users/users.module';
import { JwtConfig } from '../config/configuration';

@Module({
  imports: [
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const jwt = config.getOrThrow<JwtConfig>('jwt');

        return {
          secret: jwt.secret,
          signOptions: { expiresIn: jwt.accessTtl },
        };
      },
    }),
    MongooseModule.forFeature([
      { name: RefreshToken.name, schema: RefreshTokenSchema },
    ]),
    UsersModule,
    PassportModule,
  ],
  providers: [
    AuthService,
    RefreshTokenService,
    JwtStrategy,
    AuthThrottlerGuard,
  ],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
