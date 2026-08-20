import { Injectable } from '@nestjs/common';
import { ProductStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { MeilisearchService } from './meilisearch.service.js';
import {
  mapProductToSearchDocument,
  searchProductSelect,
} from './product-search.mapper.js';

@Injectable()
export class ProductReindexService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: MeilisearchService,
  ) {}

  async rebuild(batchSize = 250): Promise<number> {
    await this.search.ensureProductIndex();
    await this.search.clearProducts();
    let cursor: string | undefined;
    let indexed = 0;

    for (;;) {
      const products = await this.prisma.product.findMany({
        where: { status: ProductStatus.PUBLISHED },
        select: searchProductSelect,
        orderBy: { id: 'asc' },
        take: batchSize,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (products.length === 0) break;

      await this.search.upsertProducts(
        products.map(mapProductToSearchDocument),
      );
      indexed += products.length;
      cursor = products.at(-1)?.id;
    }

    return indexed;
  }
}
