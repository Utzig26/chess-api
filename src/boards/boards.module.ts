import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersSchema } from 'src/users/schemas/users.schema';
import { UsersModule } from 'src/users/users.module';
import { UsersService } from 'src/users/users.service';
import { BoardsService } from './boards.service';
import { BoardsController } from './controllers/boards.controller';
import { BoardsSchema } from './schemas/boards.schema';

@Module({
  providers: [BoardsService, UsersService],
  controllers: [BoardsController],
  imports: [
    UsersModule,
    MongooseModule.forFeature([{ name: 'Boards', schema: BoardsSchema }]),
    MongooseModule.forFeature([{ name: 'Users', schema: UsersSchema }]),
  ],
})
export class BoardsModule {}
