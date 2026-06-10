import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { env } from './config/env';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(env.api.prefix);
  app.enableCors({ origin: env.api.corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  await app.listen(env.api.port);
  new Logger('Bootstrap').log(
    `Sherpa LM API on http://localhost:${env.api.port}/${env.api.prefix}`,
  );
}
bootstrap();
