import { Injectable } from '@nestjs/common';
import { Chess } from 'chess.js';
import {
  AppliedMove,
  ChessPosition,
  GameOutcome,
  PieceColor,
} from './interfaces/chess.interface';

export const INITIAL_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

@Injectable()
export class ChessEngineService {
  readonly initialFen = INITIAL_FEN;

  position(pgn: string): ChessPosition {
    return this.describe(this.load(pgn));
  }

  legalMoves(pgn: string): string[] {
    return this.load(pgn).moves();
  }

  applyMove(pgn: string, san: string): AppliedMove | null {
    const board = this.load(pgn);

    try {
      const move = board.move(san);

      return {
        ...this.describe(board),
        san: move.san,
        color: move.color,
      };
    } catch {
      return null;
    }
  }

  private load(pgn: string): Chess {
    const board = new Chess();

    if (pgn.trim().length > 0) {
      board.loadPgn(pgn);
    }

    return board;
  }

  private describe(board: Chess): ChessPosition {
    return {
      fen: board.fen(),
      pgn: board.pgn(),
      turn: board.turn() as PieceColor,
      moveNumber: board.moveNumber(),
      outcome: this.outcomeOf(board),
    };
  }

  private outcomeOf(board: Chess): GameOutcome | null {
    if (board.isCheckmate()) return 'checkmate';
    if (board.isInsufficientMaterial()) return 'insufficientMaterial';
    if (board.isStalemate()) return 'stalemate';
    if (board.isThreefoldRepetition()) return 'threefoldRepetition';
    if (board.isDrawByFiftyMoves()) return 'fiftyMoveRule';

    return null;
  }
}
