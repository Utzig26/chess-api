import { Module } from '@nestjs/common';
import { BoardsService } from './boards.service';
import { BoardsController } from './controllers/boards.controller';

@Module({
  providers: [BoardsService],
  controllers: [BoardsController]
})
export class BoardsModule {}
