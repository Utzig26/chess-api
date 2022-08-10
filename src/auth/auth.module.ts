import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MongooseModule } from '@nestjs/mongoose';
import { PassportModule } from '@nestjs/passport';

import { UsersSchema } from 'src/users/schemas/users.schema';
import { AuthService } from './auth.service';
import { AuthController } from './controllers/auth.controller';
import { JwtStrategy } from '../common/strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { UsersService } from 'src/users/users.service';

@Module({
  providers: [AuthService, LocalStrategy, JwtStrategy, UsersService],
  controllers: [AuthController],
  exports: [AuthService],
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forFeature([{ name: 'Users', schema: UsersSchema }]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' }, // accessTokens are valid for 7 days
    }),
  ],
})
export class AuthModule {}