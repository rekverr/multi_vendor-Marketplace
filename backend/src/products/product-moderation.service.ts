import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { CatalogCacheService } from '../cache/catalog-cache.service.js';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma, ProductStatus } from '../generated/prisma/client.js';
import {
  PRODUCT_PUBLISHED,
  PRODUCT_REJECTED,
  ProductEventsService,
} from '../search/product-events.service.js';

const moderationInclude = {
  category: true,
  seller: {
    select: {
      id: true,
      displayName: true,
    },
  },
  moderatedBy: {
    select: {
      id: true,
      email: true,
    },
  },
} satisfies Prisma.ProductInclude;

@Injectable()
export class ProductModerationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: ProductEventsService,
    private readonly cache: CatalogCacheService,
  ) {}

  list(status: ProductStatus) {
    return this.prisma.product.findMany({
      where: { status },
      include: moderationInclude,
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }

  async approve(adminId: string, productId: string, correlationId: string) {
    const product = await this.transition(
      adminId,
      productId,
      correlationId,
      ProductStatus.PUBLISHED,
    );
    await this.cache.invalidateProduct(productId);
    return product;
  }

  async reject(
    adminId: string,
    productId: string,
    reason: string,
    correlationId: string,
  ) {
    const product = await this.transition(
      adminId,
      productId,
      correlationId,
      ProductStatus.REJECTED,
      reason.trim(),
    );
    await this.cache.invalidateProduct(productId);
    return product;
  }

  private async transition(
    adminId: string,
    productId: string,
    correlationId: string,
    status: 'PUBLISHED' | 'REJECTED',
    rejectionReason?: string,
  ) {
    const exists = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException('Product not found');

    return this.prisma.$transaction(async (tx) => {
      const moderatedAt = new Date();
      const transitioned = await tx.product.updateMany({
        where: { id: productId, status: ProductStatus.PENDING_REVIEW },
        data: {
          status,
          moderatedById: adminId,
          moderatedAt,
          rejectionReason:
            status === ProductStatus.REJECTED ? rejectionReason : null,
          publishedAt: status === ProductStatus.PUBLISHED ? moderatedAt : null,
        },
      });
      if (transitioned.count !== 1) {
        throw new ConflictException('Only a pending Product can be moderated');
      }

      const product = await tx.product.findUniqueOrThrow({
        where: { id: productId },
        include: moderationInclude,
      });
      await this.events.emit(
        tx,
        status === ProductStatus.PUBLISHED
          ? PRODUCT_PUBLISHED
          : PRODUCT_REJECTED,
        product.id,
        correlationId,
        product.updatedAt,
      );
      return product;
    });
  }
}
