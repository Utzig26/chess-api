import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schema/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { SignInDto } from './dto/sign-in.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {}

  async findByUsername(username: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async findById(id: string): Promise<UserDocument> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async checkPassword(signInDto: SignInDto): Promise<UserDocument | null> {
    const user = await this.userModel
      .findOne({ username: signInDto.username })
      .select('+password')
      .exec();

    if (!user) return null;

    const matches = await this.comparePassword(
      signInDto.password,
      user.password,
    );
    if (!matches) return null;

    return user;
  }

  async create(createUserDto: CreateUserDto): Promise<UserDocument> {
    const { username, password } = createUserDto;

    return this.userModel.create({
      username,
      password: await this.hashPassword(password),
    });
  }

  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  private async comparePassword(
    password: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }
}
