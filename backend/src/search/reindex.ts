import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module.js';
import { ProductReindexService } from './product-reindex.service.js';

const app = await NestFactory.createApplicationContext(AppModule);

try {
  const count = await app.get(ProductReindexService).rebuild();
  process.stdout.write(`Reindexed ${count} published Products\n`);
} finally {
  await app.close();
}
