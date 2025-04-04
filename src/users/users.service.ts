import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schema/user.schema';
import { CreateUserDto } from './dto/users.create.dto';

@Injectable()
export class UsersService {
  logger: Logger;
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {
    this.logger = new Logger(UsersService.name);
  }

  async findOne(username: string): Promise<User> {
    return this.userModel.findOne({ username: username }).exec();
  }

  async checkPassword(username: string, password: string): Promise<User> {
    const user = await this.userModel
      .findOne({ username: username })
      .select('+password')
      .exec();

    if (!user) return null;
    if (user.password !== password) return null;

    return user;
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    const createdUser = new this.userModel(createUserDto);
    return await createdUser.save();
  }
}
