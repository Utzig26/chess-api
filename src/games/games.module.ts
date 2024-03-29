import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UserSchema } from 'src/users/schemas/users.schema';
import { UsersModule } from 'src/users/users.module';
import { UsersService } from 'src/users/users.service';
import { GamesService } from './games.service';
import { GamesController } from './games.controller';
import { GameSchema } from './schemas/games.schema';
import { SSEModule } from 'src/sse/sse.module';
import { SSEService } from 'src/sse/sse.service';

@Module({
  providers: [GamesService, UsersService, SSEService],
  controllers: [GamesController],
  imports: [
    UsersModule,
    SSEModule,
    MongooseModule.forFeature([{ name: 'Games', schema: GameSchema }]),
    MongooseModule.forFeature([{ name: 'Users', schema: UserSchema }]),
  ],
  exports: [GamesService]
})
export class GamesModule {}
