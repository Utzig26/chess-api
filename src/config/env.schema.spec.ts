import { validateEnv } from './env.schema';

describe('validateEnv', () => {
  const baseEnv = {
    DB_URI: 'mongodb://localhost:27017',
    DB_NAME: 'chess',
    JWT_SECRET: 'a'.repeat(32),
    JWT_REFRESH_SECRET: 'b'.repeat(32),
  };

  it('defaults the access token ttl when it is not provided', () => {
    expect(validateEnv(baseEnv).JWT_ACCESS_TTL).toBe('15m');
  });

  it.each(['30ms', '45s', '15m', '2h', '7d'])(
    'accepts %s as an access token ttl',
    (ttl) => {
      expect(
        validateEnv({ ...baseEnv, JWT_ACCESS_TTL: ttl }).JWT_ACCESS_TTL,
      ).toBe(ttl);
    },
  );

  it.each(['15', 'm15', '15 m', '15minutes', ''])(
    'rejects %s as an access token ttl',
    (ttl) => {
      expect(() => validateEnv({ ...baseEnv, JWT_ACCESS_TTL: ttl })).toThrow(
        /JWT_ACCESS_TTL/,
      );
    },
  );

  it('rejects a secret shorter than 32 characters', () => {
    expect(() => validateEnv({ ...baseEnv, JWT_SECRET: 'short' })).toThrow(
      /JWT_SECRET/,
    );
  });

  it('defaults the refresh token ttl to seven days', () => {
    expect(validateEnv(baseEnv).JWT_REFRESH_TTL).toBe('7d');
  });

  it('rejects a refresh secret shorter than 32 characters', () => {
    expect(() =>
      validateEnv({ ...baseEnv, JWT_REFRESH_SECRET: 'short' }),
    ).toThrow(/JWT_REFRESH_SECRET/);
  });

  it('defaults the throttle limits', () => {
    const env = validateEnv(baseEnv);

    expect(env.THROTTLE_TTL).toBe(60000);
    expect(env.THROTTLE_LIMIT).toBe(120);
    expect(env.THROTTLE_AUTH_LIMIT).toBe(10);
  });

  it('coerces throttle limits coming from the environment as strings', () => {
    expect(
      validateEnv({ ...baseEnv, THROTTLE_AUTH_LIMIT: '3' }).THROTTLE_AUTH_LIMIT,
    ).toBe(3);
  });
});
