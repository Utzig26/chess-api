import { Document } from 'mongoose';

export interface Users extends Document {
  readonly username: string;
  readonly password: string;
}