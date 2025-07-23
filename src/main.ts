import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MongoExceptionFilter } from './utils/filters/mongo.global.exception.filter';
import { GlobalExceptionFilter } from './utils/filters/global.exception.filter';
import { GlobalResponseInterceptor } from './utils/interpectors/global.response.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // todo: add cookie parser
  // app.use(cookieParser());
  app.useGlobalFilters(new GlobalExceptionFilter(), new MongoExceptionFilter());
  app.useGlobalInterceptors(new GlobalResponseInterceptor());
  await app.listen(3000);
}
bootstrap();
