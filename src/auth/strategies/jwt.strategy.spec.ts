import { UnauthorizedException } from '@nestjs/common';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

describe('JwtStrategy', () => {
  let JwtStrategy: typeof import('./jwt.strategy').JwtStrategy;

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    ({ JwtStrategy } = await import('./jwt.strategy'));
  });

  const payload = (overrides: Partial<JwtPayload> = {}): JwtPayload => ({
    sub: '507f1f77bcf86cd799439011',
    username: 'magnus',
    type: 'access',
    ...overrides,
  });

  it('maps the token subject to the authenticated user id', () => {
    const strategy = new JwtStrategy();

    expect(strategy.validate(payload())).toEqual({
      id: '507f1f77bcf86cd799439011',
      username: 'magnus',
    });
  });

  it('rejects a refresh token presented as an access token', () => {
    const strategy = new JwtStrategy();

    expect(() => strategy.validate(payload({ type: 'refresh' }))).toThrow(
      UnauthorizedException,
    );
  });

  it('rejects a payload carrying no token type', () => {
    const strategy = new JwtStrategy();

    expect(() => strategy.validate(payload({ type: undefined }))).toThrow(
      UnauthorizedException,
    );
  });

  it('does not reach the database to validate a signed token', () => {
    const strategy = new JwtStrategy();

    expect(strategy.validate(payload())).toBeDefined();
    expect(Object.keys(strategy)).not.toContain('usersService');
    expect(Object.keys(strategy)).not.toContain('authService');
  });
});
