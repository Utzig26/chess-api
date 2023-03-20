import { ConflictException, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';

import { UsersDTO } from 'src/users/dto/users.dto';
import { Users } from 'src/users/interfaces/users.interface';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel('Users') private usersModel: Model<Users>, 
    private jwtService: JwtService
  ) {}

  /**
   * Creates new user with given user data.
   * @param usersDTO - validated user's data
   * @returns - user's object in case it's created successfully.
   * In case another user with same username exists, throws ConflictException.
   */
  async signUp(usersDTO: UsersDTO): Promise<Users> {
    const { username, password } = usersDTO; // extracts user's data to be saved

    const hashedPassword = await bcrypt.hash(password, 10); // hashes password using 10 saltRounds
    const user = new this.usersModel({ username, password: hashedPassword });
  
    try {
      await user.save(); // saves user to database
      return user;
    } catch (error) {
      if (error.code === 11000) { // duplicate key (username) error
        throw new ConflictException('User already exists');
      }
      throw error;
    }
  }

  /**
   * Sign-in user by generating them an accessToken
   * @param user - user's payload
   * @returns JWT's accessToken, valid for 7 days
   */
  async signIn(user: Users) {
    const payload = {
            id: user._id,
            username: user.username,
          };

    return this.jwtService.sign(payload);
  }

  /**
   * Validate user's credentials. Check whether username exists and if password hash matches.
   * @param username - user's username
   * @param password - user's plain text password
   * @returns user object if credentials are valid, otherwise returns null
   */
  async validateUser(username: string, password: string): Promise<Users> {
    const user = await this.usersModel.findOne({ username });

    if (!user) {
      return null;
    }

    const valid = await bcrypt.compare(password, user.password);

    if (valid) {
      return user;
    }

    return null;
  }
}