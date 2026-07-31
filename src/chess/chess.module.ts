import { Module } from '@nestjs/common';
import { ChessEngineService } from './chess-engine.service';

@Module({
  providers: [ChessEngineService],
  exports: [ChessEngineService],
})
export class ChessModule {}
