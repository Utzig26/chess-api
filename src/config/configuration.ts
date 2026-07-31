import { Duration, Env, validateEnv } from './env.schema';

export interface AppConfig {
  environment: Env['NODE_ENV'];
  port: number;
  corsOrigin: string;
  logLevel: Env['LOG_LEVEL'];
}

export interface DatabaseConfig {
  uri: string;
  name: string;
  username: string;
  password: string;
}

export interface JwtConfig {
  secret: string;
  accessTtl: Duration;
  refreshSecret: string;
  refreshTtl: Duration;
}

export interface ThrottleConfig {
  ttl: number;
  limit: number;
  authLimit: number;
}

export interface Configuration {
  app: AppConfig;
  database: DatabaseConfig;
  jwt: JwtConfig;
  throttle: ThrottleConfig;
}

export function configuration(): Configuration {
  const env = validateEnv(process.env);

  return {
    app: {
      environment: env.NODE_ENV,
      port: env.PORT,
      corsOrigin: env.CORS_ORIGIN,
      logLevel: env.LOG_LEVEL,
    },
    database: {
      uri: env.DB_URI,
      name: env.DB_NAME,
      username: env.DB_USERNAME,
      password: env.DB_PASSWORD,
    },
    jwt: {
      secret: env.JWT_SECRET,
      accessTtl: env.JWT_ACCESS_TTL,
      refreshSecret: env.JWT_REFRESH_SECRET,
      refreshTtl: env.JWT_REFRESH_TTL,
    },
    throttle: {
      ttl: env.THROTTLE_TTL,
      limit: env.THROTTLE_LIMIT,
      authLimit: env.THROTTLE_AUTH_LIMIT,
    },
  };
}
