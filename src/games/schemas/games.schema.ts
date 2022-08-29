import * as mongoose from 'mongoose';
import { Chess } from 'chess.js/dist/chess'
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Exclude, Transform } from 'class-transformer';
import { IsOptional } from 'class-validator';
const initalFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'

export type GameDocument = Game & Document;

@Schema({ _id : false })
export class Player {
  @Prop({ type: String })
  username: string;
  
  @Prop({ type: mongoose.SchemaTypes.ObjectId })
  id: string;
}

@Schema({ _id : false })
export class San {
  @Prop({ type: Number })
  moveNumber: number;

  @Prop({ type: String })
  move: string;

  @Prop({ type: Number})
  timestamp: number;
}

@Schema({ _id : false })
export class TimeControl {
  @Prop({ type: Number })
  increment: number;

  @Prop({ type: Number })
  black: number;

  @Prop({ type: Number })
  white: number;

  @Prop({ 
    type: Number,
    required: false,
  })
  turnTime: number
}

@Schema({ _id : false })
export class Status {
  @Prop({ 
    type: String,
    default: "WP",
  })
  gameState: string;

  @Prop({
    type: String,
    required: false,
  })
  result: string;

  @Prop({
    type: String,
    default: "Wating for the players connect",
    required: false,
  })
  aditionalInfo:string;
  
  @Prop({
    type: Number,
    required: false,
  })
  finishedAt: number;
}

@Schema({ _id : false })
export class DrawOffer {
  @Prop({
    type: Boolean,
    default: false,
  })
  white: boolean;
 
  @Prop({
    type: Boolean,
    default: false,
  })
  black: boolean;
}

@Schema({ _id : false })
export class ResignRequest {
  @Prop({ type: String, default: undefined})
  player: string;
  
  @Prop({type: Number, default: undefined })
  timestamp: number;
}

@Schema({ timestamps: true })
export class Game {
  @Prop({ 
    type: String,
    required: true,
    unique: true,
  })
  resourceId: string

  @Transform(({value}) => {return value?value.username:undefined})
  @Prop({
    type: Player,
    required: false,
  })
  whitePlayer: Player
  
  @Transform(({value}) => {return value?value.username:undefined})
  @Prop({
    type: Player,
    required: false,
  })
  blackPlayer: Player

  @Prop({ type: TimeControl })
  timeControl: TimeControl;

  @Prop({
    type: String,
    default: 'w',
  })
  turn: string;

  @Prop({
    type: String,
    default:initalFEN,
  })
  FEN: string;

  @Prop({ type: Status, default: () => ({}) })
  status: Status;

  @Prop({ type: DrawOffer, default: () => ({}) })
  drawOffer: DrawOffer;

  @Prop({ type: ResignRequest, default: () => ({}) })
  resignRequest: ResignRequest;
  
  @Prop({
    type: mongoose.SchemaTypes.Array,
    default: [],
  })
  PGN: San[];

  @Exclude()
  @Prop({ 
    type: Number,
    default: 0,
  })
  moveNumber: number;

  @Exclude()
  @Prop({
    type: Chess,
    required: true,
    default: new Chess()
  })
  board: Chess;

  @Exclude()
  createdAt: number;

  @Exclude()
  updatedAt: number;

  @Exclude()
  __v: number;

  @Exclude()
  _id: number;

  constructor(game: Partial<Object>){
    Object.assign(this, game);
  }
}
export const GameSchema = SchemaFactory.createForClass(Game);
