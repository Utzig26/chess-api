import { GameOutcome, PieceColor } from '../chess/interfaces/chess.interface';
import {
  GameResult,
  GameResultValue,
  OutcomeMessage,
  TerminationMessage,
} from './interfaces/game.interface';

export type RequestedTermination =
  | { type: 'resignation'; by: PieceColor }
  | { type: 'agreement' };

export interface Termination {
  result: GameResultValue;
  additionalInfo: string;
}

const winnerAgainst = (loser: PieceColor): GameResultValue =>
  loser === 'w' ? GameResult.blackWins : GameResult.whiteWins;

export function resolveTermination(
  outcome: GameOutcome | null,
  sideToMove: PieceColor,
  requested: RequestedTermination | null,
): Termination | null {
  if (outcome === 'checkmate') {
    return {
      result: winnerAgainst(sideToMove),
      additionalInfo: OutcomeMessage.checkmate,
    };
  }

  if (outcome) {
    return {
      result: GameResult.draw,
      additionalInfo: OutcomeMessage[outcome],
    };
  }

  if (!requested) {
    return null;
  }

  if (requested.type === 'resignation') {
    return {
      result: winnerAgainst(requested.by),
      additionalInfo:
        requested.by === 'w'
          ? TerminationMessage.whiteResigned
          : TerminationMessage.blackResigned,
    };
  }

  return {
    result: GameResult.draw,
    additionalInfo: TerminationMessage.agreement,
  };
}
