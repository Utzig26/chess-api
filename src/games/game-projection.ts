import { PieceColor } from '../chess/interfaces/chess.interface';
import {
  GameResult,
  GameResultValue,
  GameState,
  GameStateValue,
  StatusMessage,
} from './interfaces/game.interface';
import { GameDocument } from './schema/game.schema';

export interface ProjectedClock {
  white: number;
  black: number;
  increment: number;
}

export interface ProjectedStatus {
  state: GameStateValue;
  result: GameResultValue | null;
  additionalInfo: string;
  finishedAt: Date | null;
}

export interface GameProjection {
  timeControl: ProjectedClock;
  status: ProjectedStatus;
  expiredFor: PieceColor | null;
}

const round = (seconds: number): number =>
  Math.max(0, Math.round(seconds * 10) / 10);

export const opposite = (color: PieceColor): PieceColor =>
  color === 'w' ? 'b' : 'w';

export function projectGame(game: GameDocument, now: Date): GameProjection {
  const { white, black, increment } = game.timeControl;
  const stored: GameProjection = {
    timeControl: { white, black, increment },
    status: {
      state: game.status.state,
      result: game.status.result,
      additionalInfo: game.status.additionalInfo,
      finishedAt: game.status.finishedAt,
    },
    expiredFor: null,
  };

  if (game.status.state !== GameState.active) {
    return stored;
  }

  const since = game.history[game.history.length - 1]?.timestamp;
  if (!since) {
    return stored;
  }

  const remaining =
    game.timeControl.turnTime - (now.getTime() - since.getTime()) / 1000;

  if (remaining > 0) {
    stored.timeControl[game.turn === 'w' ? 'white' : 'black'] =
      round(remaining);

    return stored;
  }

  return {
    timeControl: {
      ...stored.timeControl,
      [game.turn === 'w' ? 'white' : 'black']: 0,
    },
    status: {
      state: GameState.finished,
      result: game.turn === 'w' ? GameResult.blackWins : GameResult.whiteWins,
      additionalInfo: StatusMessage.wonOnTime,
      finishedAt: now,
    },
    expiredFor: game.turn,
  };
}

export function spentSince(reference: Date, at: Date): number {
  return (at.getTime() - reference.getTime()) / 1000;
}

export function clockAfterMove(
  turnTime: number,
  spent: number,
  increment: number,
): number {
  return round(turnTime - spent + increment);
}
