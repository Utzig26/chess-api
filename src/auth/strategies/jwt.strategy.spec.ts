import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtStrategy } from './jwt.strategy';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

describe('JwtStrategy', () => {
  const config = {
    getOrThrow: () => ({ secret: 'a-test-secret', accessTtl: '15m' }),
  } as unknown as ConfigService;

  const strategy = () => new JwtStrategy(config);

  const payload = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
    sub: '507f1f77bcf86cd799439011',
    username: 'magnus',
    type: 'access',
    ...overrides,
  });

  it('maps the token subject to the authenticated user id', () => {
    expect(strategy().validate(payload())).toEqual({
      id: '507f1f77bcf86cd799439011',
      username: 'magnus',
    });
  });

  it('rejects a refresh token presented as an access token', () => {
    expect(() => strategy().validate(payload({ type: 'refresh' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a payload carrying no token type', () => {
    expect(() => strategy().validate(payload({ type: undefined }))).toThrow(
      UnauthorizedException,
    );
  });

  it('does not hold a reference to any user lookup service', () => {
    const keys = Object.keys(strategy());

    expect(keys).not.toContain('usersService');
    expect(keys).not.toContain('authService');
  });
});
