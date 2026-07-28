import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './schema/user.schema';
import { UserCreateDto } from './dto/user.create.dto';
import * as bcrypt from 'bcrypt';
import { UserSignDto } from './dto/user.sign.dto';

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findOne(username: string): Promise<UserDocument> {
    return this.userModel.findOne({ username: username }).exec();
  }

  async checkPassword(userSignDto: UserSignDto): Promise<UserDocument> {
    const user = await this.userModel
      .findOne({ username: userSignDto.username })
      .select('+password')
      .exec();

    if (!user) return null;

    const matches = await this.comparePassword(
      userSignDto.password,
      user.password,
    );
    if (!matches) return null;

    return user;
  }

  async create(userCreateDto: UserCreateDto): Promise<UserDocument> {
    const { password, username } = userCreateDto;
    if (await this.findOne(username))
      throw new ConflictException('User already exists');

    return this.userModel.create({
      username,
      password: await this.hashPassword(password),
    });
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
