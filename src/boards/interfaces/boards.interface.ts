import { Document, ObjectId } from 'mongoose';

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
}

