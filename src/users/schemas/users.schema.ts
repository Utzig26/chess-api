import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Expose } from 'class-transformer';
import * as mongoose from 'mongoose';

/**
 * Schema of user's data to be saved in database
 * @example { 'username': 'Magnus.Carlsen', 'password': '***********', ... }
 */

export type UserDocument = User & Document;

@Schema()
export class User {
  @Expose()
  id: string;

  @Prop({ 
    type: String,
    unique: true,
    required: true,
  })
  username: string
  
  @Prop({
    type: String,
    required: true,
  })
  password: string;
}
export const UserSchema = SchemaFactory.createForClass(User);
