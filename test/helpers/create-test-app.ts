import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { MongooseModule } from '@nestjs/mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

export interface TestApp {
  app: INestApplication;
  close: () => Promise<void>;
}

export const TEST_JWT_SECRET = 'e2e-test-secret';

export async function createTestApp(): Promise<TestApp> {
  process.env.JWT_SECRET = TEST_JWT_SECRET;

  const mongo = await MongoMemoryServer.create();

  const { AuthModule } = await import('../../src/auth/auth.module');
  const { UsersModule } = await import('../../src/users/users.module');
  const { GlobalExceptionFilter } = await import(
    '../../src/utils/filters/global.exception.filter'
  );
  const { MongoExceptionFilter } = await import(
    '../../src/utils/filters/mongo.global.exception.filter'
  );
  const { GlobalResponseInterceptor } = await import(
    '../../src/utils/interpectors/global.response.interceptor'
  );

  const moduleRef = await Test.createTestingModule({
    imports: [MongooseModule.forRoot(mongo.getUri()), AuthModule, UsersModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter(), new MongoExceptionFilter());
  app.useGlobalInterceptors(new GlobalResponseInterceptor());

  await app.init();

  return {
    app,
    close: async () => {
      await app.close();
      await mongo.stop();
    },
  };
}
