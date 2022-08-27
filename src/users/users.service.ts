import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Users } from './interfaces/users.interface';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel('Users') private usersModel: Model<Users>, 
  ) {}

  /**
   * Extracts relevant user's data from MongoDB Document
   * @param user - user's object
   * @returns relevant user's data.
   */
  findById(id:string) {
    const user = this.usersModel.findById(id)
    
    if(!user) {
      return null;
    }
    return user
  }
  extractUserData(user: Users) {
    return {
      id: user['id'],
      username: user['username'],
    };
  }
}