import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({
    type: String,
    readonly: true,
  })
  id: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  })
  username: string;

  @Prop({
    type: String,
    required: true,
    select: false,
  })
  password: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
