import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getModelToken } from '@nestjs/mongoose';
import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'crypto';
import { RefreshTokenService } from './refresh-token.service';
import { RefreshToken } from './schema/refresh-token.schema';
import { UserDocument } from '../users/schema/user.schema';

describe('RefreshTokenService', () => {
  const refreshSecret = 'unit-test-refresh-secret-long-enough-ok';
  const userId = '507f1f77bcf86cd799439011';
  const user = { id: userId, username: 'magnus' } as UserDocument;

  let service: RefreshTokenService;
  let jwtService: JwtService;
  let model: {
    create: jest.Mock;
    findOne: jest.Mock;
    updateMany: jest.Mock;
  };

  const sha256 = (value: string) =>
    createHash('sha256').update(value).digest('hex');

  const storedRecord = (overrides: Record<string, unknown> = {}) => ({
    family: 'family-1',
    revokedAt: null,
    replacedBy: null,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  });

  beforeEach(async () => {
    model = {
      create: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
      updateMany: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        JwtService,
        { provide: getModelToken(RefreshToken.name), useValue: model },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: () => ({
              secret: 'unit-test-access-secret-long-enough-ok',
              accessTtl: '15m',
              refreshSecret,
              refreshTtl: '7d',
            }),
          },
        },
      ],
    }).compile();

    service = module.get(RefreshTokenService);
    jwtService = module.get(JwtService);
  });

  describe('issue', () => {
    it('persists only the hash of the token, never the token itself', async () => {
      const { token } = await service.issue(user);

      const [persisted] = model.create.mock.calls[0];
      expect(persisted.tokenHash).toBe(sha256(token));
      expect(JSON.stringify(persisted)).not.toContain(token);
    });

    it('signs a refresh typed token bound to the user', async () => {
      const { token } = await service.issue(user);

      const payload = jwtService.verify(token, { secret: refreshSecret });

      expect(payload.sub).toBe(userId);
      expect(payload.username).toBe('magnus');
      expect(payload.type).toBe('refresh');
    });

    it('records an expiry that matches the token expiry claim', async () => {
      const { token, expiresAt } = await service.issue(user);

      const { exp } = jwtService.verify(token, { secret: refreshSecret });

      expect(expiresAt.getTime()).toBe(exp * 1000);
    });

    it('starts a new family when none is given', async () => {
      await service.issue(user);
      await service.issue(user);

      const [first] = model.create.mock.calls[0];
      const [second] = model.create.mock.calls[1];

      expect(first.family).not.toBe(second.family);
    });

    it('keeps the given family when rotating within a session', async () => {
      await service.issue(user, 'family-1');

      expect(model.create.mock.calls[0][0].family).toBe('family-1');
    });
  });

  describe('rotate', () => {
    it('issues a new token in the same family', async () => {
      const { token } = await service.issue(user);
      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(storedRecord()),
      });

      const rotated = await service.rotate(token);

      expect(rotated.token).not.toBe(token);
      expect(model.create.mock.calls[1][0].family).toBe('family-1');
    });

    it('revokes the presented token and points it at its replacement', async () => {
      const { token } = await service.issue(user);
      const stored = storedRecord();
      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(stored),
      });

      const rotated = await service.rotate(token);

      expect(stored.revokedAt).toBeInstanceOf(Date);
      expect(stored.replacedBy).toBe(sha256(rotated.token));
      expect(stored.save).toHaveBeenCalled();
    });

    it('revokes the whole family when an already used token comes back', async () => {
      const { token } = await service.issue(user);
      model.findOne.mockReturnValue({
        exec: jest
          .fn()
          .mockResolvedValue(storedRecord({ revokedAt: new Date() })),
      });

      await expect(service.rotate(token)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(model.updateMany).toHaveBeenCalledWith(
        { family: 'family-1', revokedAt: null },
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('rejects a token that is not in the store', async () => {
      const { token } = await service.issue(user);
      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.rotate(token)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects a token signed with another secret', async () => {
      const forged = jwtService.sign(
        { sub: userId, username: 'magnus', type: 'refresh', family: 'f' },
        { secret: 'a-totally-different-secret-long-enough' },
      );

      await expect(service.rotate(forged)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(model.findOne).not.toHaveBeenCalled();
    });

    it('rejects an expired token', async () => {
      const expired = jwtService.sign(
        { sub: userId, username: 'magnus', type: 'refresh', family: 'f' },
        { secret: refreshSecret, expiresIn: '-1s' },
      );

      await expect(service.rotate(expired)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an access token presented as a refresh token', async () => {
      const access = jwtService.sign(
        { sub: userId, username: 'magnus', type: 'access' },
        { secret: refreshSecret },
      );

      await expect(service.rotate(access)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(model.findOne).not.toHaveBeenCalled();
    });
  });

  describe('revocation', () => {
    it('revokes the family behind a token on sign out', async () => {
      const { token } = await service.issue(user);
      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(storedRecord()),
      });

      await service.revokeByToken(token);

      expect(model.updateMany).toHaveBeenCalledWith(
        { family: 'family-1', revokedAt: null },
        expect.objectContaining({ revokedAt: expect.any(Date) }),
      );
    });

    it('stays quiet when the token is unknown', async () => {
      model.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.revokeByToken('unknown')).resolves.toBeUndefined();
      expect(model.updateMany).not.toHaveBeenCalled();
    });

    it('revokes every live token of a user', async () => {
      await service.revokeAllForUser(userId);

      const [filter] = model.updateMany.mock.calls[0];
      expect(filter.userId.toString()).toBe(userId);
      expect(filter.revokedAt).toBeNull();
    });
  });
});
