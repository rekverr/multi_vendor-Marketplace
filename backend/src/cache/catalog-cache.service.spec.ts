import { jest } from '@jest/globals';
import { CatalogCacheService } from './catalog-cache.service.js';

describe('CatalogCacheService', () => {
  it('invalidates Product detail and Category list keys', async () => {
    const redis = {
      del: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
    };
    const cache = new CatalogCacheService({
      createClient: () => redis,
    } as never);

    await cache.invalidateProduct('product-id');
    await cache.invalidateCategories();

    expect(redis.del).toHaveBeenNthCalledWith(1, 'catalog:product:product-id');
    expect(redis.del).toHaveBeenNthCalledWith(2, 'catalog:categories:list');
  });

  it('does not fail the caller when Redis invalidation fails', async () => {
    const cache = new CatalogCacheService({
      createClient: () => ({
        del: jest.fn().mockRejectedValue(new Error('offline')),
      }),
    } as never);

    await expect(
      cache.invalidateProduct('product-id'),
    ).resolves.toBeUndefined();
  });
});
