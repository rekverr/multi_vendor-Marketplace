import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { CatalogCacheService } from '../cache/catalog-cache.service.js';
import { MeilisearchService } from '../search/meilisearch.service.js';
import {
  ProductSearchSort,
  PublicProductQueryDto,
} from './dto/public-product-query.dto.js';

const publicProductSelect = {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  type: true,
  price: true,
  stock: true,
  ratingAverage: true,
  ratingCount: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
    },
  },
  seller: {
    select: {
      id: true,
      displayName: true,
    },
  },
  auction: {
    select: {
      id: true,
      status: true,
    },
  },
} satisfies Prisma.ProductSelect;

@Injectable()
export class PublicProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly search: MeilisearchService,
    private readonly cache: CatalogCacheService,
  ) {}

  async list(query: PublicProductQueryDto) {
    const minPrice = query.minPrice
      ? new Prisma.Decimal(query.minPrice)
      : undefined;
    const maxPrice = query.maxPrice
      ? new Prisma.Decimal(query.maxPrice)
      : undefined;

    if (minPrice && maxPrice && minPrice.greaterThan(maxPrice)) {
      throw new BadRequestException('minPrice must not exceed maxPrice');
    }

    const filters = [
      query.categoryId ? `categoryId = "${query.categoryId}"` : undefined,
      query.sellerId ? `sellerId = "${query.sellerId}"` : undefined,
      minPrice ? `price >= ${minPrice.toString()}` : undefined,
      maxPrice ? `price <= ${maxPrice.toString()}` : undefined,
      query.available === undefined
        ? undefined
        : `inStock = ${query.available}`,
    ].filter((value): value is string => Boolean(value));

    const sort = {
      [ProductSearchSort.NEWEST]: ['publishedAt:desc', 'id:asc'],
      [ProductSearchSort.PRICE_ASC]: ['price:asc', 'id:asc'],
      [ProductSearchSort.PRICE_DESC]: ['price:desc', 'id:asc'],
    }[query.sort];

    try {
      const result = await this.search.searchProducts(query.q ?? '', {
        filter: filters,
        sort,
        offset: (query.page - 1) * query.pageSize,
        limit: query.pageSize,
        facets: ['categoryId', 'sellerId', 'type', 'inStock'],
      });
      const total = result.estimatedTotalHits ?? result.hits.length;
      const ids = result.hits.map((hit) => hit.id);
      const products = await this.prisma.product.findMany({
        where: { id: { in: ids }, status: ProductStatus.PUBLISHED },
        select: publicProductSelect,
      });
      const productsById = new Map(
        products.map((product) => [product.id, product]),
      );
      return {
        items: ids.flatMap((id) => {
          const product = productsById.get(id);
          return product ? [product] : [];
        }),
        facets: result.facetDistribution ?? {},
        pagination: {
          page: query.page,
          pageSize: query.pageSize,
          total,
          totalPages: Math.ceil(total / query.pageSize),
        },
      };
    } catch {
      throw new ServiceUnavailableException({
        message: 'Product search is temporarily unavailable',
        degraded: true,
      });
    }
  }

  async getById(id: string) {
    const cached = await this.cache.getProduct<unknown>(id);
    if (cached) return cached;

    const product = await this.prisma.product.findFirst({
      where: { id, status: ProductStatus.PUBLISHED },
      select: publicProductSelect,
    });

    if (!product) {
      await this.cache.invalidateProduct(id);
      throw new NotFoundException('Product not found');
    }

    await this.cache.setProduct(id, product);
    return product;
  }
}
