import { Document, ObjectId } from 'mongoose';
import { Chess } from 'chess.js/dist/chess'
import { DrawOffer, Player, ResignRequest, San, Status, TimeControl } from '../schemas/games.schema'
import { User } from 'src/users/schemas/users.schema';

export interface Games extends Document {
  readonly id: string;
  readonly resourceId: string;
  whitePlayer: Player;
  blackPlayer: Player;
  moveNumber: number;
  PGN: [San];
  FEN: string;
  readonly timeControl: TimeControl;
  turn: string;
  status: Status;
  drawOffer: DrawOffer;
  resignRequest: ResignRequest;
  board: Chess;
}

