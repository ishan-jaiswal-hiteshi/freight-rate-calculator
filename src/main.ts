/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
//import * as multer from 'multer';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: '*',
    methods: ['GET', 'HEAD', 'PUT', 'Put', 'POST', 'DELETE'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true,
  });

  // Enable file upload
  // app.use(multer({ dest: './uploads' }).single('files'));

  await app.listen(3000);
}
bootstrap();
