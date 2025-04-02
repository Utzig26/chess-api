import { Module } from '@nestjs/common';
import { User, UserSchema } from './schema/user.sschema';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
//import { UsersController } from './users.controller';
import { UsersController } from './users.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
