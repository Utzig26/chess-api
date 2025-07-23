import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schema/user.schema';
import { UserCreateDto } from './dto/user.create.dto';
import * as bcrypt from 'bcrypt';
import { UserSignDto } from './dto/user.sign.dto';

@Injectable()
export class UsersService {
  logger: Logger;
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findOne(username: string): Promise<User> {
    return this.userModel.findOne({ username: username }).exec();
  }

  async checkPassword(userSignDto: UserSignDto): Promise<User> {
    const user = await this.userModel
      .findOne({ username: userSignDto.username })
      .select('+password')
      .exec();

    if (!user) return null;
    if (!this.comparePassword(userSignDto.password, user.password)) return null;

    return user;
  }

  async create(userCreateDto: UserCreateDto): Promise<User> {
    const { password, username } = userCreateDto;
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
