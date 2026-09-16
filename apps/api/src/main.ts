import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { env } from './config/env';

// Raise outbound fetch timeouts (OCR/FCM/WhatsApp). Node's undici defaults to a
// 10s connect timeout, which a slow VPN/proxy can exceed -> "fetch failed".
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { setGlobalDispatcher, Agent } = require('undici');
  setGlobalDispatcher(
    new Agent({ connect: { timeout: 60_000 }, headersTimeout: 120_000, bodyTimeout: 120_000 }),
  );
} catch {
  /* undici unavailable — default fetch timeouts apply */
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(env.api.prefix);
  app.enableCors({ origin: env.api.corsOrigins, credentials: true });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  await app.listen(env.api.port);
  new Logger('Bootstrap').log(
    `PasarEx LM API on http://localhost:${env.api.port}/${env.api.prefix}`,
  );
}
bootstrap();
