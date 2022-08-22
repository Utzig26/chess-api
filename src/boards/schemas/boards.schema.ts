import * as mongoose from 'mongoose';
import { Chess } from 'chess.js/dist/chess'

/**
 * gameState constants
 * {W: Wating, WP: Wating Player, F: Finished, A: Active}
 */


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
    username: {
      type: String,
    },
    id: {
      type: mongoose.SchemaTypes.ObjectId,
    },
    required: false,
  },

  blackPlayer: {
    username: {
      type: String,
    },
    id: {
      type: mongoose.SchemaTypes.ObjectId,
    },
    required: false,
  },
  moveNumber:{
    type: Number,
    default: 0,
  },
  PGN:{
    type:[{
      moveNumber: Number,
      move: String,
      timestamp: Number,
    }],
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
  
  turn:{
    type: String,
    default: 'w',
  },

  status:{
    gameState:{
      type: String,
      default: "WP",
    },
    finishedAt:{
      type: Number,
      required: false,
    },
    aditionalInfo:{
      type: String,
      default: "Wating for the players connect",
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