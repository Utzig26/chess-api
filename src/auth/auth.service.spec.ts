import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schema/user.schema';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { create: jest.Mock; checkPassword: jest.Mock };
  let jwtService: { signAsync: jest.Mock };

  const userId = '507f1f77bcf86cd799439011';
  const user = { id: userId, username: 'magnus' } as UserDocument;

  beforeEach(async () => {
    usersService = { create: jest.fn(), checkPassword: jest.fn() };
    jwtService = { signAsync: jest.fn().mockResolvedValue('signed.jwt.token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  describe('signUp', () => {
    it('issues an access token for the created user', async () => {
      usersService.create.mockResolvedValue(user);

      await expect(
        service.signUp({ username: 'magnus', password: 'valid-password' }),
      ).resolves.toEqual({ accessToken: 'signed.jwt.token' });
    });

    it('signs a payload carrying the user id as subject', async () => {
      usersService.create.mockResolvedValue(user);

      await service.signUp({ username: 'magnus', password: 'valid-password' });

      expect(jwtService.signAsync).toHaveBeenCalledWith({
        sub: userId,
        username: 'magnus',
        type: 'access',
      });
    });
  });

  describe('signIn', () => {
    it('issues an access token when the credentials match', async () => {
      usersService.checkPassword.mockResolvedValue(user);

      await expect(
        service.signIn({ username: 'magnus', password: 'valid-password' }),
      ).resolves.toEqual({ accessToken: 'signed.jwt.token' });
    });

    it('rejects when the credentials do not match', async () => {
      usersService.checkPassword.mockResolvedValue(null);

      await expect(
        service.signIn({ username: 'magnus', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('never signs a token when the credentials do not match', async () => {
      usersService.checkPassword.mockResolvedValue(null);

      await expect(
        service.signIn({ username: 'magnus', password: 'wrong-password' }),
      ).rejects.toThrow();
      expect(jwtService.signAsync).not.toHaveBeenCalled();
    });

    it('reports the same message for a wrong password and an unknown user', async () => {
      usersService.checkPassword.mockResolvedValue(null);

      const wrongPassword = await service
        .signIn({ username: 'magnus', password: 'wrong-password' })
        .catch((error: Error) => error.message);
      const unknownUser = await service
        .signIn({ username: 'ghost', password: 'any-password' })
        .catch((error: Error) => error.message);

      expect(wrongPassword).toBe(unknownUser);
    });

    it('never signs a payload with an undefined subject', async () => {
      usersService.checkPassword.mockResolvedValue(user);

      await service.signIn({ username: 'magnus', password: 'valid-password' });

      const [payload] = jwtService.signAsync.mock.calls[0];
      expect(payload.sub).toBeDefined();
      expect(payload.sub).toBe(userId);
    });
  });
});
