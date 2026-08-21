import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Index, Meilisearch, SearchParams } from 'meilisearch';
import { ProductSearchDocument } from './product-search.types.js';

@Injectable()
export class MeilisearchService implements OnApplicationBootstrap {
  private readonly logger = new Logger(MeilisearchService.name);
  private readonly client: Meilisearch;
  private readonly products: Index<ProductSearchDocument>;

  constructor(config: ConfigService) {
    this.client = new Meilisearch({
      host: config.getOrThrow<string>('MEILI_HOST'),
      apiKey: config.getOrThrow<string>('MEILI_MASTER_KEY'),
    });
    this.products = this.client.index<ProductSearchDocument>('products');
  }

  onApplicationBootstrap(): void {
    void this.ensureProductIndex().catch((error) => {
      this.logger.error({
        event: 'SEARCH_INDEX_INIT_FAILED',
        error: this.errorMessage(error),
      });
    });
  }

  async ensureProductIndex(): Promise<void> {
    const task = this.products.updateSettings({
      searchableAttributes: [
        'title',
        'description',
        'categoryName',
        'sellerName',
      ],
      filterableAttributes: [
        'categoryId',
        'sellerId',
        'type',
        'inStock',
        'price',
        'ratingAverage',
      ],
      sortableAttributes: [
        'price',
        'ratingAverage',
        'publishedAt',
        'updatedAt',
        'id',
      ],
      displayedAttributes: ['*'],
    });
    await task.waitTask();
  }

  async upsertProduct(document: ProductSearchDocument): Promise<void> {
    const task = this.products.addDocuments([document], {
      primaryKey: 'id',
    });
    await task.waitTask();
  }

  async upsertProducts(documents: ProductSearchDocument[]): Promise<void> {
    if (documents.length === 0) return;
    const task = this.products.addDocuments(documents, {
      primaryKey: 'id',
    });
    await task.waitTask();
  }

  async deleteProduct(id: string): Promise<void> {
    const task = this.products.deleteDocument(id);
    await task.waitTask();
  }

  async clearProducts(): Promise<void> {
    const task = this.products.deleteAllDocuments();
    await task.waitTask();
  }

  searchProducts(query: string, params: SearchParams) {
    return this.products.search(query, params);
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'Unknown error';
  }
}
