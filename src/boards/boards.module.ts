import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BoardsService } from './boards.service';
import { BoardsController } from './controllers/boards.controller';
import { BoardsSchema } from './schemas/boards.schema';

@Module({
  providers: [BoardsService],
  controllers: [BoardsController],
  imports: [
    MongooseModule.forFeature([{ name: 'Boards', schema: BoardsSchema }]),
  ],
})
export class BoardsModule {}
