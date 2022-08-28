import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { GamesModule } from './games/games.module';
import { SSEModule } from './sse/sse.module';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(
      process.env.MONGO_URI, { 
        useNewUrlParser: true,
        useUnifiedTopology: true }
    ),
    AuthModule,
    UsersModule,
    GamesModule,
    SSEModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
