
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
    @Prop({
        readonly: true
    })
    id: string;

    @Prop({
        required: true,
        unique: true,
        type: String
    })
    username: string;

    @Prop({
        required: true,
        type: String
    })
    password: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
