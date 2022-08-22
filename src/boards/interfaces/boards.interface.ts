import { Document, ObjectId } from 'mongoose';
import { Chess } from 'chess.js/dist/chess'

type GameState = "W" | "WP" | "F" | "A";

export interface Boards extends Document {
  readonly id: string;
  readonly resourceId: string;
  whitePlayer:{
    id: ObjectId;
    username: string;
  };
  blackPlayer: {
    id: ObjectId;
    username: string;
  };
  moveNumber: number;
  PGN: [
    {
      moveNumber: number;
      move: string;
      timestamp: number;
    }
  ];
  FEN: string;
  readonly timeControl: {
    increment: number;
    black: number;
    white: number;
  };
  turn: string;
  status: {
    gameState: GameState;
    finishedAt: number;
    aditionalInfo: string;
  };
  drawOffer: {
    black: boolean;
    white: boolean;
  }
  board: Chess;
}

