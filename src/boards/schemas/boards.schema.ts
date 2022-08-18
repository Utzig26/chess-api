import * as mongoose from 'mongoose';
import { Chess } from 'chess.js/dist/chess'

/**
 * gameState constants
 * {W: Wating, WP: Wating Player, F: Finished, A: Active}
 */

export const gameState = {
  "W": "Wating for the first move.", 
  "WP": "Wating for the players connect.",
  "F": "This match has alreary finished.", 
  "A": "This match is on",
}
const initalFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'

/**
 * Schema of user's data to be saved in database
 * @example { 'username': 'Magnus.Carlsen', 'password': '***********', ... }
 */
export const BoardsSchema = new mongoose.Schema({
  resourceId : {
    type: String,
    required: true,
    unique: true,
  },

  whitePlayer: {
    type: mongoose.SchemaTypes.ObjectId,
    required: false,
  },

  blackPlayer:{
    type: mongoose.SchemaTypes.ObjectId,
    required: false,
  },

  PGN:{
    type: [[String,Number]],
    default:[],
  },
  FEN:{
    type: String,
    default:initalFEN,
  },
  timeControl:{ //all three attributes must be in x100 milliseconds
    increment:{
      type: Number,
    },
    black:{
      type: Number,
    },
    white:{
      type: Number,
    },
  },
  status:{
    gameState:{
      type: String,
      default: gameState.WP,
    },
    finishedAt:{
      type: mongoose.SchemaTypes.Date,
      required: false,
    },
    aditionalInfo:{
      type: String,
      required: false,
    },
  },
  drawOffer:{
    black:{
      type: Boolean,
      default: false,
    },
    white:{
      type: Boolean,
      default: false,
    },
  },
  board : {
    type: mongoose.SchemaTypes.Mixed,
    default: new Chess(),
    required: true,
  },
}, 
{ timestamps: true }, //Mongoose will then set createdAt when the document is first inserted, and update updatedAt whenever you update the document
);