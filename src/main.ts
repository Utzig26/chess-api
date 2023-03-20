import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import * as cookieParser from 'cookie-parser'

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors( { 
    origin: [process.env.CORS_ORIGIN],
    methods: ['POST', 'GET'],
    credentials: true
  });
  app.use(cookieParser());
  await app.listen(3000);
}
bootstrap();
