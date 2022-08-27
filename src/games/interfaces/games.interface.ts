import { Document, ObjectId } from 'mongoose';
import { Chess } from 'chess.js/dist/chess'

type GameState = "W" | "WP" | "F" | "A";

export interface Games extends Document {
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
      timestemp: number;
    }
  ];
  FEN: string;
  readonly timeControl: {
    increment: number;
    black: number;
    white: number;
    turnTime: number;
  };
  turn: string;
  status: {
    gameState: GameState;
    finishedAt: number;
    aditionalInfo: string;
    result: string;
  };
  drawOffer: {
    black: boolean;
    white: boolean;
  }
  resignRequest:{
    player:string;
    timeStemp: number;
  };
  board: Chess;
}

