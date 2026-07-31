import { ApiProperty } from '@nestjs/swagger';
import { PieceColor } from '../../chess/interfaces/chess.interface';
import { GameResultValue, GameStateValue } from '../interfaces/game.interface';
import { GameDocument } from '../schema/game.schema';

class GameStatusDto {
  @ApiProperty({ enum: ['WP', 'W', 'A', 'F'], example: 'WP' })
  readonly state: GameStateValue;

  @ApiProperty({
    nullable: true,
    enum: ['White wins', 'Black wins', 'Draw'],
    example: null,
  })
  readonly result: GameResultValue | null;

  @ApiProperty({ example: 'Waiting for the players to connect' })
  readonly additionalInfo: string;

  @ApiProperty({ nullable: true, example: null })
  readonly finishedAt: Date | null;
}

class GameTimeControlDto {
  @ApiProperty({ example: 600 })
  readonly white: number;

  @ApiProperty({ example: 600 })
  readonly black: number;

  @ApiProperty({ example: 5 })
  readonly increment: number;
}

class MoveDto {
  @ApiProperty({ example: 'Nf3' })
  readonly san: string;

  @ApiProperty({ example: 1 })
  readonly moveNumber: number;

  @ApiProperty({ example: '2026-07-28T12:00:00.000Z' })
  readonly timestamp: Date;
}

export class GameResponseDto {
  @ApiProperty({ example: 'brave-crimson-knight-e4' })
  readonly id: string;

  @ApiProperty({ nullable: true, example: 'magnus' })
  readonly whitePlayer: string | null;

  @ApiProperty({ nullable: true, example: null })
  readonly blackPlayer: string | null;

  @ApiProperty({ enum: ['w', 'b'], example: 'w' })
  readonly turn: PieceColor;

  @ApiProperty({
    example: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  })
  readonly fen: string;

  @ApiProperty({ example: '' })
  readonly pgn: string;

  @ApiProperty({ type: [MoveDto] })
  readonly history: MoveDto[];

  @ApiProperty({ type: GameTimeControlDto })
  readonly timeControl: GameTimeControlDto;

  @ApiProperty({ type: GameStatusDto })
  readonly status: GameStatusDto;

  @ApiProperty({ example: '2026-07-28T12:00:00.000Z' })
  readonly createdAt: Date;

  constructor(game: GameDocument) {
    this.id = game.resourceId;
    this.whitePlayer = game.whitePlayer?.username ?? null;
    this.blackPlayer = game.blackPlayer?.username ?? null;
    this.turn = game.turn;
    this.fen = game.fen;
    this.pgn = game.pgn;
    this.history = game.history.map((move) => ({
      san: move.san,
      moveNumber: move.moveNumber,
      timestamp: move.timestamp,
    }));
    this.timeControl = {
      white: game.timeControl.white,
      black: game.timeControl.black,
      increment: game.timeControl.increment,
    };
    this.status = {
      state: game.status.state,
      result: game.status.result,
      additionalInfo: game.status.additionalInfo,
      finishedAt: game.status.finishedAt,
    };
    this.createdAt = game.get('createdAt');
  }
}
