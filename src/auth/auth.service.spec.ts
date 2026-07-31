import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RefreshTokenService } from './refresh-token.service';
import { UsersService } from '../users/users.service';
import { UserDocument } from '../users/schema/user.schema';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: { create: jest.Mock; checkPassword: jest.Mock };
  let refreshTokenService: {
    issue: jest.Mock;
    rotate: jest.Mock;
    revokeByToken: jest.Mock;
    revokeAllForUser: jest.Mock;
  };
  let jwtService: { signAsync: jest.Mock };

  const userId = '507f1f77bcf86cd799439011';
  const user = { id: userId, username: 'magnus' } as UserDocument;
  const expiresAt = new Date('2026-08-04T00:00:00.000Z');

  beforeEach(async () => {
    usersService = { create: jest.fn(), checkPassword: jest.fn() };
    refreshTokenService = {
      issue: jest.fn().mockResolvedValue({ token: 'refresh.token', expiresAt }),
      rotate: jest.fn(),
      revokeByToken: jest.fn().mockResolvedValue(undefined),
      revokeAllForUser: jest.fn().mockResolvedValue(undefined),
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('access.token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: RefreshTokenService, useValue: refreshTokenService },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('signUp', () => {
    it('opens a session for the created user', async () => {
      usersService.create.mockResolvedValue(user);

      await expect(
        service.signUp({ username: 'magnus', password: 'valid-password' }),
      ).resolves.toEqual({
        accessToken: 'access.token',
        refreshToken: 'refresh.token',
        refreshExpiresAt: expiresAt,
      });
    });

    it('signs an access typed payload carrying the user id', async () => {
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
    it('opens a session when the credentials match', async () => {
      usersService.checkPassword.mockResolvedValue(user);

      const session = await service.signIn({
        username: 'magnus',
        password: 'valid-password',
      });

      expect(session.accessToken).toBe('access.token');
      expect(refreshTokenService.issue).toHaveBeenCalledWith(user);
    });

    it('rejects when the credentials do not match', async () => {
      usersService.checkPassword.mockResolvedValue(null);

      await expect(
        service.signIn({ username: 'magnus', password: 'wrong-password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('issues nothing when the credentials do not match', async () => {
      usersService.checkPassword.mockResolvedValue(null);

      await expect(
        service.signIn({ username: 'magnus', password: 'wrong-password' }),
      ).rejects.toThrow();

      expect(jwtService.signAsync).not.toHaveBeenCalled();
      expect(refreshTokenService.issue).not.toHaveBeenCalled();
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
  });

  describe('refresh', () => {
    it('returns a fresh pair from the rotated token', async () => {
      refreshTokenService.rotate.mockResolvedValue({
        token: 'rotated.token',
        expiresAt,
        user: { id: userId, username: 'magnus' },
      });

      await expect(service.refresh('old.token')).resolves.toEqual({
        accessToken: 'access.token',
        refreshToken: 'rotated.token',
        refreshExpiresAt: expiresAt,
      });
    });

    it('does not reach the user collection to refresh', async () => {
      refreshTokenService.rotate.mockResolvedValue({
        token: 'rotated.token',
        expiresAt,
        user: { id: userId, username: 'magnus' },
      });

      await service.refresh('old.token');

      expect(usersService.checkPassword).not.toHaveBeenCalled();
      expect(usersService.create).not.toHaveBeenCalled();
    });
  });

  describe('sign out', () => {
    it('revokes the session behind the presented token', async () => {
      await service.signOut('refresh.token');

      expect(refreshTokenService.revokeByToken).toHaveBeenCalledWith(
        'refresh.token',
      );
    });

    it('revokes every session of the account', async () => {
      await service.signOutEverywhere(userId);

      expect(refreshTokenService.revokeAllForUser).toHaveBeenCalledWith(userId);
    });
  });
});
