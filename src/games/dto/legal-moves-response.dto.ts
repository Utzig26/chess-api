import { ApiProperty } from '@nestjs/swagger';
import { GameResponseDto } from './game-response.dto';
import { GameDocument } from '../schema/game.schema';

export class LegalMovesResponseDto {
  @ApiProperty({ type: GameResponseDto })
  readonly game: GameResponseDto;

  @ApiProperty({
    type: [String],
    description: 'Every move that is legal in the current position',
    example: ['e4', 'e3', 'Nf3', 'Nc3'],
  })
  readonly moves: string[];

  constructor(game: GameDocument, moves: string[]) {
    this.game = new GameResponseDto(game);
    this.moves = moves;
  }
}
