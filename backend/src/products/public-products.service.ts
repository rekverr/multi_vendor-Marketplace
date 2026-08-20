import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ProductStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { PublicProductQueryDto } from './dto/public-product-query.dto.js';

const publicProductSelect = {
  id: true,
  title: true,
  description: true,
  imageUrl: true,
  type: true,
  price: true,
  stock: true,
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
} satisfies Prisma.ProductSelect;

@Injectable()
export class PublicProductsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.PUBLISHED,
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.sellerId ? { sellerId: query.sellerId } : {}),
      ...(minPrice || maxPrice
        ? {
            price: {
              ...(minPrice ? { gte: minPrice } : {}),
              ...(maxPrice ? { lte: maxPrice } : {}),
            },
          }
        : {}),
      ...(query.available === true ? { stock: { gt: 0 } } : {}),
      ...(query.available === false ? { stock: 0 } : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        select: publicProductSelect,
        orderBy: [{ publishedAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        totalPages: Math.ceil(total / query.pageSize),
      },
    };
  }

  async getById(id: string) {
    const product = await this.prisma.product.findFirst({
      where: { id, status: ProductStatus.PUBLISHED },
      select: publicProductSelect,
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }
}
