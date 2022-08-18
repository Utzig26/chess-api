import { Document, ObjectId } from 'mongoose';
import { Chess } from 'chess.js/dist/chess'

export interface Boards extends Document {
  readonly id: string;
  readonly resourceId: string;
  whitePlayer: ObjectId;
  blackPlayer: ObjectId;
  PGN: [[string,number]];
  FEN: string;
  readonly timeControl: {
    increment: number;
    black: number;
    white: number;
  };
  status: {
    gameState: string;
    finishedAt: number;
    adtionalInfo: string;
  };
  drawOffer: {
    black: boolean;
    white: boolean;
  }
  board: Chess;
}

