import { validateEnv } from './env.schema';

describe('validateEnv', () => {
  const baseEnv = {
    DB_URI: 'mongodb://localhost:27017',
    DB_NAME: 'chess',
    JWT_SECRET: 'a'.repeat(32),
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
});
