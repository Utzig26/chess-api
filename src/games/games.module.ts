import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersSchema } from 'src/users/schemas/users.schema';
import { UsersModule } from 'src/users/users.module';
import { UsersService } from 'src/users/users.service';
import { GamesService } from './games.service';
import { GamesController } from './controllers/games.controller';
import { GamesSchema } from './schemas/games.schema';

@Module({
  providers: [GamesService, UsersService],
  controllers: [GamesController],
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: 'Games', schema: GamesSchema }]),
    MongooseModule.forFeature([{ name: 'Users', schema: UsersSchema }]),
  ],
})
export class GamesModule {}
