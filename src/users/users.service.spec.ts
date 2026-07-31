import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './schema/user.schema';

jest.mock('bcrypt');

const mockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

describe('UsersService', () => {
  let service: UsersService;
  let userModel: {
    findOne: jest.Mock;
    create: jest.Mock;
  };

  const storedUser = {
    _id: '507f1f77bcf86cd799439011',
    username: 'magnus',
    password: '$2b$10$storedhash',
  };

  const queryReturning = (value: unknown) => ({
    select: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  });

  beforeEach(async () => {
    userModel = {
      findOne: jest.fn(),
      create: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: userModel },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  describe('checkPassword', () => {
    it('returns the user when the password matches', async () => {
      userModel.findOne.mockReturnValue(queryReturning(storedUser));
      mockedBcrypt.compare.mockResolvedValue(true as never);

      const result = await service.checkPassword({
        username: 'magnus',
        password: 'correct-password',
      });

      expect(result).toEqual(storedUser);
    });

    it('returns null when the password does not match', async () => {
      userModel.findOne.mockReturnValue(queryReturning(storedUser));
      mockedBcrypt.compare.mockResolvedValue(false as never);

      const result = await service.checkPassword({
        username: 'magnus',
        password: 'wrong-password',
      });

      expect(result).toBeNull();
    });

    it('returns null when the user does not exist', async () => {
      userModel.findOne.mockReturnValue(queryReturning(null));

      const result = await service.checkPassword({
        username: 'ghost',
        password: 'any-password',
      });

      expect(result).toBeNull();
      expect(mockedBcrypt.compare).not.toHaveBeenCalled();
    });

    it('compares against the stored hash and never the plaintext', async () => {
      userModel.findOne.mockReturnValue(queryReturning(storedUser));
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await service.checkPassword({
        username: 'magnus',
        password: 'correct-password',
      });

      expect(mockedBcrypt.compare).toHaveBeenCalledWith(
        'correct-password',
        storedUser.password,
      );
    });

    it('explicitly selects the password, which the schema hides by default', async () => {
      const query = queryReturning(storedUser);
      userModel.findOne.mockReturnValue(query);
      mockedBcrypt.compare.mockResolvedValue(true as never);

      await service.checkPassword({
        username: 'magnus',
        password: 'correct-password',
      });

      expect(query.select).toHaveBeenCalledWith('+password');
    });
  });
});
