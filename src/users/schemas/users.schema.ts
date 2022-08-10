import * as mongoose from 'mongoose';

/**
 * Schema of user's data to be saved in database
 * @example { 'name': 'Magnus Carlsen', 'password': '***********', ... }
 */
export const UsersSchema = new mongoose.Schema({
  username: {
    type: String,
    unique: true,
    required:true,
  },
  
  password: {
    type: String,
    required:true,
  },
});