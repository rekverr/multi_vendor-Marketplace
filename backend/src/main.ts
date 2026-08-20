import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import {
  DocumentBuilder,
  SwaggerModule,
} from '@nestjs/swagger';

import { AppModule } from './app.module.js';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  const port =
    configService.get<number>('PORT') ?? 3000;

  const corsOrigin =
    configService.get<string>('CORS_ORIGIN') ??
    'http://localhost:5173';

  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(
    new AllExceptionsFilter(),
  );

  app.enableShutdownHooks();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Multi-Vendor Marketplace API')
    .setDescription(
      'API for Multi-Vendor Marketplace + Real-Time Inventory',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const swaggerDocument =
    SwaggerModule.createDocument(
      app,
      swaggerConfig,
    );

  SwaggerModule.setup(
    'docs',
    app,
    swaggerDocument,
  );

  await app.listen(port);

  console.log(
    `API running on http://localhost:${port}`,
  );

  console.log(
    `Swagger: http://localhost:${port}/docs`,
  );
}

void bootstrap();