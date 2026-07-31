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

export const TEST_JWT_SECRET = 'e2e-test-secret-that-is-long-enough-here';

export async function createTestApp(): Promise<TestApp> {
  const mongo = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.DB_URI = mongo.getUri();
  process.env.DB_NAME = 'chess-test';
  process.env.DB_USERNAME = '';
  process.env.DB_PASSWORD = '';
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.LOG_LEVEL = 'silent';

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
