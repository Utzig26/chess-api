import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schema/user.schema';
import { CreateUserDto } from './dto/users.create.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class UsersService {
  logger: Logger;
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

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
    const { password, username } = createUserDto;
    const hashedPassword = await this.hashPassword(password);
    const user: User = new this.userModel({
      username: username,
      password: hashedPassword,
    });
    return await this.userModel.create(user);
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    return hash;
  }

  private async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return await bcrypt.compare(password, hashedPassword);
  }
}
