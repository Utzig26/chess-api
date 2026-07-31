import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { INITIAL_FEN } from '../../chess/chess-engine.service';
import { PieceColor } from '../../chess/interfaces/chess.interface';
import {
  GameResultValue,
  GameState,
  GameStateValue,
  StatusMessage,
} from '../interfaces/game.interface';

export type GameDocument = HydratedDocument<Game>;

@Schema({ _id: false })
export class GamePlayer {
  @Prop({ type: Types.ObjectId, required: true })
  id: Types.ObjectId;

  @Prop({ type: String, required: true })
  username: string;
}

@Schema({ _id: false })
export class TimeControl {
  @Prop({ type: Number, required: true })
  white: number;

  @Prop({ type: Number, required: true })
  black: number;

  @Prop({ type: Number, required: true })
  increment: number;

  @Prop({ type: Number, required: true })
  turnTime: number;
}

@Schema({ _id: false })
export class GameStatus {
  @Prop({
    type: String,
    required: true,
    enum: Object.values(GameState),
    default: GameState.waitingForPlayers,
  })
  state: GameStateValue;

  @Prop({ type: String, default: null })
  result: GameResultValue | null;

  @Prop({
    type: String,
    required: true,
    default: StatusMessage.waitingForPlayers,
  })
  additionalInfo: string;

  @Prop({ type: Date, default: null })
  finishedAt: Date | null;
}

@Schema({ _id: false })
export class DrawOffer {
  @Prop({ type: Boolean, default: false })
  white: boolean;

  @Prop({ type: Boolean, default: false })
  black: boolean;
}

@Schema({ _id: false })
export class MoveRecord {
  @Prop({ type: String, required: true })
  san: string;

  @Prop({ type: Number, required: true })
  moveNumber: number;

  @Prop({ type: Date, required: true })
  timestamp: Date;
}

@Schema({
  timestamps: true,
  toJSON: { versionKey: false },
})
export class Game {
  @Prop({ type: String, required: true, unique: true })
  resourceId: string;

  @Prop({ type: GamePlayer, default: null })
  whitePlayer: GamePlayer | null;

  @Prop({ type: GamePlayer, default: null })
  blackPlayer: GamePlayer | null;

  @Prop({ type: String, required: true, default: 'w' })
  turn: PieceColor;

  @Prop({ type: String, required: true, default: INITIAL_FEN })
  fen: string;

  @Prop({ type: String, default: '' })
  pgn: string;

  @Prop({ type: [MoveRecord], default: [] })
  history: MoveRecord[];

  @Prop({ type: TimeControl, required: true })
  timeControl: TimeControl;

  @Prop({ type: GameStatus, required: true, default: () => ({}) })
  status: GameStatus;

  @Prop({ type: DrawOffer, required: true, default: () => ({}) })
  drawOffer: DrawOffer;

  @Prop({ type: Date, default: null })
  startedAt: Date | null;
}

export const GameSchema = SchemaFactory.createForClass(Game);

GameSchema.index({ 'status.state': 1, createdAt: -1 });
GameSchema.index({ 'whitePlayer.id': 1, updatedAt: -1 });
GameSchema.index({ 'blackPlayer.id': 1, updatedAt: -1 });
