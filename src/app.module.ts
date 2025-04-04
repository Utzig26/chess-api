import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuthController } from './auth/auth.controller';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.DB_URI, {
      dbName: process.env.DB_NAME,
      authSource: 'admin',
      auth: {
        username: process.env.DB_USERNAME,
        password: process.env.DB_PASSWORD,
      },
    }),
    AuthModule,
    UsersModule,
  ],
  controllers: [AuthController],
  providers: [],
})
export class AppModule {}
