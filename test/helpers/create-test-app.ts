import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

export interface TestApp {
  app: INestApplication;
  reset: () => Promise<void>;
  close: () => Promise<void>;
}

export interface TestAppOptions {
  authThrottleLimit?: number;
}

export const TEST_JWT_SECRET = 'e2e-test-secret-that-is-long-enough-here';
export const TEST_REFRESH_SECRET = 'e2e-refresh-secret-that-is-long-enough!!';

export async function createTestApp({
  authThrottleLimit = 500,
}: TestAppOptions = {}): Promise<TestApp> {
  const mongo = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.DB_URI = mongo.getUri();
  process.env.DB_NAME = 'chess-test';
  process.env.DB_USERNAME = '';
  process.env.DB_PASSWORD = '';
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.JWT_REFRESH_SECRET = TEST_REFRESH_SECRET;
  process.env.LOG_LEVEL = process.env.DEBUG_LOG ? 'error' : 'silent';
  process.env.THROTTLE_LIMIT = '5000';
  process.env.THROTTLE_AUTH_LIMIT = String(authThrottleLimit);

  const { AppModule } = await import('../../src/app.module');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  await app.init();

  const connection = app.get<Connection>(getConnectionToken());

  return {
    app,
    reset: () => connection.dropDatabase(),
    close: async () => {
      await app.close();
      await mongo.stop();
    },
  };
}
