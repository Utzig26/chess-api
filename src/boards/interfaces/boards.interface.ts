import { Document, ObjectId } from 'mongoose';

export interface Boards extends Document {
  readonly id: string;
  readonly resourceId: string;
  readonly whitePlayer: ObjectId;
  readonly blackPlayer: ObjectId;
  readonly PGN: [[string,number]];
  readonly FEN: string;
  readonly timeControl: {
    increment: number;
    black: number;
    white: number;
  };
  readonly status: {
    gameState: string;
    finishedAt: number;
    adtionalInfo: string;
  };
  readonly drawOffer: {
    black: boolean;
    white: boolean;
  }
}

