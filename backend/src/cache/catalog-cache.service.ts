import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { RedisConnectionService } from '../queue/redis-connection.service.js';

@Injectable()
export class CatalogCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(CatalogCacheService.name);
  private readonly redis: Redis;
  private readonly productTtlSeconds = 60;
  private readonly categoriesTtlSeconds = 300;

  constructor(connection: RedisConnectionService) {
    this.redis = connection.createClient({
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      connectTimeout: 1000,
    });
  }

  async getProduct<T>(id: string): Promise<T | null> {
    return this.get<T>(`catalog:product:${id}`);
  }

  async setProduct(id: string, value: unknown): Promise<void> {
    await this.set(`catalog:product:${id}`, value, this.productTtlSeconds);
  }

  async invalidateProduct(id: string): Promise<void> {
    await this.remove(`catalog:product:${id}`);
  }

  async getCategories<T>(): Promise<T | null> {
    return this.get<T>('catalog:categories:list');
  }

  async setCategories(value: unknown): Promise<void> {
    await this.set('catalog:categories:list', value, this.categoriesTtlSeconds);
  }

  async invalidateCategories(): Promise<void> {
    await this.remove('catalog:categories:list');
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }

  private async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      return value ? (JSON.parse(value) as T) : null;
    } catch (error) {
      this.logFailure('CACHE_READ_FAILED', key, error);
      return null;
    }
  }

  private async set(key: string, value: unknown, ttl: number): Promise<void> {
    try {
      await this.redis.set(key, JSON.stringify(value), 'EX', ttl);
    } catch (error) {
      this.logFailure('CACHE_WRITE_FAILED', key, error);
    }
  }

  private async remove(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      this.logFailure('CACHE_INVALIDATION_FAILED', key, error);
    }
  }

  private logFailure(event: string, key: string, error: unknown): void {
    this.logger.warn({
      event,
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
