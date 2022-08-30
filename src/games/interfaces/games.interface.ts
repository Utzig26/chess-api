import { Document } from 'mongoose';
import { Chess } from 'chess.js/dist/chess'
import { DrawOffer, Player, ResignRequest, moveData, Status, TimeControl } from '../schemas/games.schema'

export interface Games extends Document {
  readonly id: string;
  readonly resourceId: string;
  whitePlayer: Player;
  blackPlayer: Player;
  moveNumber: number;
  history: [moveData];
  FEN: string;
  readonly timeControl: TimeControl;
  turn: string;
  status: Status;
  drawOffer: DrawOffer;
  resignRequest: ResignRequest;
  board: Chess;
}

