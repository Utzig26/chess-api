import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MongoExceptionFilter } from './utils/filters/mongo.globalFilter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // todo: add cookie parser
  // app.use(cookieParser());
  app.useGlobalFilters(new MongoExceptionFilter());
  await app.listen(3000);
}
bootstrap();
