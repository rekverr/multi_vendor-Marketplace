import {
  BadRequestException,
  Injectable,
  NotFoundException,
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

    const authoritativeWhere = this.buildAuthoritativeWhere(
      query,
      minPrice,
      maxPrice,
    );
    const authoritativeTotal = await this.prisma.product.count({
      where: authoritativeWhere,
    });

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
        where: { AND: [authoritativeWhere, { id: { in: ids } }] },
        select: publicProductSelect,
      });
      const productsById = new Map(
        products.map((product) => [product.id, product]),
      );
      const expectedPageSize = Math.min(
        query.pageSize,
        Math.max(authoritativeTotal - (query.page - 1) * query.pageSize, 0),
      );

      if (
        total !== authoritativeTotal ||
        ids.length !== expectedPageSize ||
        products.length !== expectedPageSize
      ) {
        return this.listFromPostgres(
          query,
          authoritativeWhere,
          authoritativeTotal,
        );
      }

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
      return this.listFromPostgres(
        query,
        authoritativeWhere,
        authoritativeTotal,
      );
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

  private buildAuthoritativeWhere(
    query: PublicProductQueryDto,
    minPrice?: Prisma.Decimal,
    maxPrice?: Prisma.Decimal,
  ): Prisma.ProductWhereInput {
    const text = query.q?.trim();
    return {
      status: ProductStatus.PUBLISHED,
      categoryId: query.categoryId,
      sellerId: query.sellerId,
      price:
        minPrice || maxPrice
          ? {
              gte: minPrice,
              lte: maxPrice,
            }
          : undefined,
      stock:
        query.available === undefined
          ? undefined
          : query.available
            ? { gt: 0 }
            : 0,
      OR: text
        ? [
            { title: { contains: text, mode: 'insensitive' } },
            { description: { contains: text, mode: 'insensitive' } },
            {
              category: {
                name: { contains: text, mode: 'insensitive' },
              },
            },
            {
              seller: {
                displayName: { contains: text, mode: 'insensitive' },
              },
            },
          ]
        : undefined,
    };
  }

  private async listFromPostgres(
    query: PublicProductQueryDto,
    where: Prisma.ProductWhereInput,
    total: number,
  ) {
    const orderByBySort = {
      [ProductSearchSort.NEWEST]: [
        { publishedAt: { sort: 'desc', nulls: 'last' } },
        { id: 'asc' },
      ],
      [ProductSearchSort.PRICE_ASC]: [
        { price: { sort: 'asc', nulls: 'last' } },
        { id: 'asc' },
      ],
      [ProductSearchSort.PRICE_DESC]: [
        { price: { sort: 'desc', nulls: 'last' } },
        { id: 'asc' },
      ],
    } satisfies Record<
      ProductSearchSort,
      Prisma.ProductOrderByWithRelationInput[]
    >;
    const orderBy = orderByBySort[query.sort];

    const [items, category, seller, type, available, unavailable] =
      await Promise.all([
        this.prisma.product.findMany({
          where,
          select: publicProductSelect,
          orderBy,
          skip: (query.page - 1) * query.pageSize,
          take: query.pageSize,
        }),
        this.prisma.product.groupBy({
          by: ['categoryId'],
          where,
          _count: { _all: true },
        }),
        this.prisma.product.groupBy({
          by: ['sellerId'],
          where,
          _count: { _all: true },
        }),
        this.prisma.product.groupBy({
          by: ['type'],
          where,
          _count: { _all: true },
        }),
        this.prisma.product.count({
          where: { AND: [where, { stock: { gt: 0 } }] },
        }),
        this.prisma.product.count({ where: { AND: [where, { stock: 0 }] } }),
      ]);

    return {
      items,
      facets: {
        categoryId: Object.fromEntries(
          category.map((entry) => [entry.categoryId, entry._count._all]),
        ),
        sellerId: Object.fromEntries(
          seller.map((entry) => [entry.sellerId, entry._count._all]),
        ),
        type: Object.fromEntries(
          type.map((entry) => [entry.type, entry._count._all]),
        ),
        inStock: {
          true: available,
          false: unavailable,
        },
      },
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
      degraded: true,
    };
  }
}
